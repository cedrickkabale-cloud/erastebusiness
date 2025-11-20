const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { db, init } = require('./db');
const bcrypt = require('bcrypt');
const path = require('path');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const cookieParser = require('cookie-parser');

init();

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

// configure CORS to allow credentials from frontend (use env or default to recent dev port)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5175';
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

function authenticateToken(req, res, next){
  // Look for token in cookie first, then Authorization header
  const cookieToken = req.cookies && req.cookies.token;
  const auth = req.headers['authorization'] || '';
  const headerToken = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;
  const token = cookieToken || headerToken;
  if(!token) return res.status(401).json({ error: 'Token manquant' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if(err) return res.status(403).json({ error: 'Token invalide' });
    req.user = user;
    next();
  });
}

// Simple auth endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!user) return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect. Veuillez réessayer.' });
    bcrypt.compare(password, user.password).then(match => {
        if (!match) return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect. Veuillez réessayer.' });
        const payload = { id: user.id, username: user.username, role: user.role, full_name: user.full_name };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
        // set httpOnly cookie; secure in production
        const secureCookie = process.env.NODE_ENV === 'production';
        res.cookie('token', token, { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/', maxAge: 8 * 3600 * 1000 });
        res.json({ user: payload });
      }).catch(() => res.status(500).json({ error: "Erreur d'authentification" }));
  });
});
 
// endpoint to return current user based on cookie / token
app.get('/api/me', (req, res) => {
  const cookieToken = req.cookies && req.cookies.token;
  const auth = req.headers['authorization'] || '';
  const headerToken = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;
  const token = cookieToken || headerToken;
  if(!token) return res.status(401).json({ error: 'Not authenticated' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if(err) return res.status(403).json({ error: 'Invalid token' });
    res.json({ user });
  });
});

// Create invoice
app.post('/api/invoices', authenticateToken, (req, res) => {
  const inv = req.body;
  if (!inv.nom_client || !inv.date_emission || !inv.lines || !Array.isArray(inv.lines) || inv.lines.length === 0) {
    return res.status(400).json({ error: 'Champs manquants pour la facture.' });
  }
  // generate numero_facture: EB-YYYY-000001
  const year = new Date(inv.date_emission).getFullYear();
  db.get('SELECT COUNT(*) as c FROM invoices', (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const counter = (row.c + 1).toString().padStart(6, '0');
    const numero = `EB-${year}-${counter}`;
    db.run(`INSERT INTO invoices (numero_facture,date_emission,heure_emission,nom_client,id_vendeur,total,devise,qr_data) VALUES (?,?,?,?,?,?,?,?)`, [
      numero,
      inv.date_emission,
      inv.heure_emission || '',
      inv.nom_client,
      inv.id_vendeur || req.user.id,
      inv.total || 0,
      inv.devise || 'CDF',
      inv.qr_data || ''
    ], function(err2) {
      if (err2) return res.status(500).json({ error: 'DB insert error' });
      const invoiceId = this.lastID;
      const stmt = db.prepare(`INSERT INTO invoice_lines (invoice_id,numero_ordre,designation,quantite,prix_unitaire,montant) VALUES (?,?,?,?,?,?)`);
      inv.lines.forEach(l => {
        stmt.run([invoiceId, l.numero_ordre, l.designation, l.quantite, l.prix_unitaire, l.montant]);
      });
      stmt.finalize(() => {
        res.json({ success: true, id: invoiceId, numero_facture: numero });
      });
    });
  });
});

// List invoices
app.get('/api/invoices', authenticateToken, (req, res) => {
  // only admin can list all invoices
  if(req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  db.all('SELECT * FROM invoices ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Get invoice by id
app.get('/api/invoices/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM invoices WHERE id = ?', [id], (err, invoice) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!invoice) return res.status(404).json({ error: 'Facture non trouvée' });
    db.all('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY numero_ordre', [id], (err2, lines) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      res.json({ ...invoice, lines });
    });
  });
});

// Delete invoice
app.delete('/api/invoices/:id', authenticateToken, (req, res) => {
  // only admin can delete
  if(req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  const id = req.params.id;
  db.run('DELETE FROM invoice_lines WHERE invoice_id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    db.run('DELETE FROM invoices WHERE id = ?', [id], function(err2) {
      if (err2) return res.status(500).json({ error: 'DB error' });
      res.json({ success: true });
    });
  });
});

// Generate PDF ticket (supports exact 72 mm width and A4 via ?format=a4)
app.get('/api/invoices/:id/pdf', authenticateToken, (req, res) => {
  const id = req.params.id;
  const format = (req.query.format || '').toLowerCase();
  db.get('SELECT * FROM invoices WHERE id = ?', [id], (err, invoice) => {
    if (err || !invoice) return res.status(404).json({ error: 'Facture non trouvée' });
    db.all('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY numero_ordre', [id], async (err2, lines) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      // build PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${invoice.numero_facture}.pdf"`);

      // convert mm to PDF points and helpers
      const mmToPoints = (mm) => mm * 72 / 25.4;
      const ticketWidthPts = Math.round(mmToPoints(72)); // exact 72 mm width

      let doc;
      if(format === 'a4'){
        doc = new PDFDocument({ size: 'A4', margin: 40 });
        // A4 header
        try{
          const fs = require('fs');
          const logoPath = path.join(__dirname, 'public', 'logo-eraste.png');
          if (fs.existsSync(logoPath)){
            doc.image(logoPath, doc.page.width/2 - 40, 30, { width: 80 });
            doc.moveDown(2);
          }
        }catch(e){}
        doc.fontSize(16).text('Ets Eraste Business SARL', { align: 'center' });
        doc.fontSize(11).text('Ministère / Service (multi‑ligne si nécessaire)', { align: 'center' });
        doc.moveDown(0.5);
      }else{
        doc = new PDFDocument({ size: [ticketWidthPts, 400 + lines.length * 16], margin: 8 });
        doc.fontSize(12).text('Ets Eraste Business SARL', { align: 'center' });
        doc.fontSize(9).text('Marché MITENDI', { align: 'center' });
        doc.moveDown(0.5);
      }

      doc.pipe(res);

      // common header info
      doc.fontSize(9);
      doc.text(`Facture N° : ${invoice.numero_facture}`);
      doc.text(`Date : ${invoice.date_emission}  Heure : ${invoice.heure_emission}`);
      doc.text(`Client : ${invoice.nom_client}`);
      if (req.user && req.user.full_name) doc.text(`Gérant : ${req.user.full_name}`);
      doc.moveDown(0.5);

      doc.text('--------------------------------');
      lines.forEach(l => {
        doc.text(`${l.numero_ordre}. ${l.designation}`);
        doc.text(`${l.quantite} x ${Number(l.prix_unitaire).toFixed(2)}  = ${Number(l.montant).toFixed(2)}`, { align: 'right' });
      });
      doc.text('--------------------------------');
      doc.fontSize(11).text(`Total : ${Number(invoice.total).toFixed(2)} ${invoice.devise}`, { align: 'right' });
      doc.moveDown(0.5);
      doc.fontSize(8).text("La marchandise vendue n'est ni reprise ni échangée", { align: 'center' });
      doc.text('Merci et à la prochaine', { align: 'center' });

      // QR code as dataURL
      const qrText = JSON.stringify({ id: invoice.id, numero: invoice.numero_facture, total: invoice.total });
      try{
        const dataUrl = await QRCode.toDataURL(qrText);
        const base64 = dataUrl.split(',')[1];
        const img = Buffer.from(base64, 'base64');
        const imgWidth = Math.min(120, (doc.page.width - (doc.page.margins ? doc.page.margins.left + doc.page.margins.right : 16)) - 16);
        const imgX = (doc.page.width - imgWidth) / 2;
        doc.image(img, imgX, doc.y + 8, { width: imgWidth });
      }catch(e){ }
      doc.end();
    });
  });
});

// Preview endpoint removed for security — use the protected `/api/invoices/:id/pdf` route instead.

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend started on http://localhost:${PORT}`));
