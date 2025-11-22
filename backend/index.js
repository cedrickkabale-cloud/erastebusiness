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

// Brand configuration for PDF generation and theming - Blend Ministère + Eraste
const BRAND_PRIMARY = process.env.BRAND_PRIMARY || '#1e40af'; // Bleu institutionnel
const BRAND_ACCENT = process.env.BRAND_ACCENT || '#10b981'; // Vert business
const BRAND_GOLD = process.env.BRAND_GOLD || '#f59e0b'; // Or RDC
const BRAND_TEXT = process.env.BRAND_TEXT || '#ffffff';
const PDF_FONT_PATH = process.env.PDF_FONT_PATH || null;

// configure CORS to allow credentials from frontend (use env or default)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5175';
const allowedOrigins = FRONTEND_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);

// dynamic origin validator: allow configured origins, and localhost/127.0.0.1 origins
const corsOptionsDelegate = function (req, callback) {
  const origin = req.header('Origin');
  // allow non-browser requests (no Origin)
  if (!origin) return callback(null, { origin: true, credentials: true });
  // allow explicit configured origins
  if (allowedOrigins.includes(origin)) return callback(null, { origin: origin, credentials: true });
  // allow localhost or 127.0.0.1 with any port for dev convenience
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, { origin: origin, credentials: true });
  // otherwise reject
  return callback(new Error('Not allowed by CORS'), { origin: false });
};

app.use(cors(corsOptionsDelegate));

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

// Public endpoint to get the 'seller of the day' (most recently created vendeur_* user)
app.get('/api/seller-of-day', (req, res) => {
  // try to find a user with username pattern 'vendeur_%' newest first
  db.get("SELECT username, full_name FROM users WHERE role = 'vendeur' AND username LIKE 'vendeur_%' ORDER BY id DESC LIMIT 1", (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (row) return res.json({ username: row.username, full_name: row.full_name });
    // fallback: any vendeur
    db.get("SELECT username, full_name FROM users WHERE role = 'vendeur' ORDER BY id DESC LIMIT 1", (err2, row2) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      if (!row2) return res.status(404).json({ error: 'Aucun vendeur trouvé' });
      res.json({ username: row2.username, full_name: row2.full_name });
    });
  });
});

// Admin-only: return (one-time) seller credentials and remove them from .secrets
app.get('/api/admin/seller-credentials', authenticateToken, (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  const fs = require('fs');
  const secretsPath = path.join(__dirname, '.secrets');
  if (!fs.existsSync(secretsPath)) return res.status(404).json({ error: 'Aucune credential trouvée' });
  try{
    const raw = fs.readFileSync(secretsPath, 'utf8') || '{}';
    const data = JSON.parse(raw || '{}');
    const entries = Object.entries(data);
    if (entries.length === 0) return res.status(404).json({ error: 'Aucune credential trouvée' });
    // pick latest by createdAt if present, otherwise last key
    let selectedKey = null;
    let selectedVal = null;
    let latest = 0;
    for (const [k, v] of entries){
      const t = v && v.createdAt ? Date.parse(v.createdAt) : 0;
      if (t > latest){ latest = t; selectedKey = k; selectedVal = v; }
    }
    if (!selectedKey){ selectedKey = entries[entries.length-1][0]; selectedVal = entries[entries.length-1][1]; }

    // remove selected from file (one-time)
    delete data[selectedKey];
    fs.writeFileSync(secretsPath, JSON.stringify(data, null, 2));

    return res.json({ username: selectedKey, password: selectedVal.password });
  }catch(e){
    return res.status(500).json({ error: 'Erreur serveur' });
  }
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
  const compact = (req.query.compact === '1' || req.query.compact === 'true');
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
      const fs = require('fs');
      // load custom font if provided
      const fontPath = (PDF_FONT_PATH && fs.existsSync(PDF_FONT_PATH)) ? PDF_FONT_PATH : null;

      if(format === 'a4'){
        doc = new PDFDocument({ size: 'A4', margin: 50 });
        if (fontPath) try{ doc.font(fontPath); } catch(e){}
        
        // Header avec gradient simulé et logos
        doc.rect(0, 0, doc.page.width, 100).fill(BRAND_PRIMARY);
        doc.rect(0, 100, doc.page.width, 4).fill(BRAND_GOLD);
        
        // Titre principal
        doc.fillColor(BRAND_TEXT).fontSize(22).font('Helvetica-Bold')
           .text('RÉPUBLIQUE DÉMOCRATIQUE DU CONGO', 50, 20, { align: 'center', width: doc.page.width - 100 });
        doc.fontSize(14).font('Helvetica')
           .text('Ministère de l\'Entreprenariat et Développement des PME', 50, 48, { align: 'center', width: doc.page.width - 100 });
        doc.fontSize(18).font('Helvetica-Bold')
           .text('Ets Eraste Business SARL', 50, 72, { align: 'center', width: doc.page.width - 100 });
        
        doc.fillColor('black').font('Helvetica');
        doc.y = 120;
        
        // Titre facture
        doc.fontSize(20).font('Helvetica-Bold').fillColor(BRAND_PRIMARY)
           .text('FACTURE DE VENTE', { align: 'center' });
        doc.moveDown(0.5);
        
        // Informations facture dans un cadre
        const infoBoxY = doc.y;
        doc.rect(50, infoBoxY, doc.page.width - 100, 80).stroke('#e5e7eb');
        
        doc.fontSize(11).fillColor('black').font('Helvetica-Bold');
        doc.text(`N° de Facture : `, 60, infoBoxY + 15, { continued: true })
           .font('Helvetica').fillColor(BRAND_GOLD).text(`${invoice.numero_facture}`);
        
        doc.font('Helvetica-Bold').fillColor('black')
           .text(`Date d'émission : `, 60, infoBoxY + 35, { continued: true })
           .font('Helvetica').text(`${invoice.date_emission} à ${invoice.heure_emission}`);
        
        doc.font('Helvetica-Bold').fillColor('black')
           .text(`Client : `, 60, infoBoxY + 55, { continued: true })
           .font('Helvetica').text(`${invoice.nom_client}`);
        
        if (req.user && req.user.full_name) {
          doc.font('Helvetica-Bold').fillColor('black')
             .text(`Gérant : `, doc.page.width - 250, infoBoxY + 15, { continued: true })
             .font('Helvetica').text(`${req.user.full_name}`);
        }
        
        doc.y = infoBoxY + 95;
        doc.moveDown(1);
        
        // Tableau des articles
        const tableTop = doc.y;
        const colX = {
          no: 60,
          desc: 100,
          qty: 360,
          price: 430,
          amount: 490
        };
        
        // En-tête du tableau
        doc.rect(50, tableTop, doc.page.width - 100, 30).fill(BRAND_PRIMARY);
        doc.fillColor(BRAND_TEXT).fontSize(11).font('Helvetica-Bold');
        doc.text('N°', colX.no, tableTop + 10);
        doc.text('Désignation', colX.desc, tableTop + 10);
        doc.text('Qté', colX.qty, tableTop + 10);
        doc.text('Prix Unit.', colX.price, tableTop + 10);
        doc.text('Montant', colX.amount, tableTop + 10);
        
        let rowY = tableTop + 35;
        doc.fillColor('black').font('Helvetica').fontSize(10);
        
        lines.forEach((l, idx) => {
          const bgColor = idx % 2 === 0 ? '#f9fafb' : '#ffffff';
          doc.rect(50, rowY - 5, doc.page.width - 100, 25).fill(bgColor).stroke('#e5e7eb');
          
          doc.fillColor('black');
          doc.text(`${l.numero_ordre}`, colX.no, rowY, { width: 30 });
          doc.text(`${l.designation}`, colX.desc, rowY, { width: 250 });
          doc.text(`${l.quantite}`, colX.qty, rowY, { width: 60, align: 'center' });
          doc.text(`${Number(l.prix_unitaire).toFixed(2)}`, colX.price, rowY, { width: 50, align: 'right' });
          doc.text(`${Number(l.montant).toFixed(2)}`, colX.amount, rowY, { width: 60, align: 'right' });
          
          rowY += 25;
        });
        
        // Total avec fond doré
        doc.rect(50, rowY, doc.page.width - 100, 40).fill(BRAND_GOLD);
        doc.fillColor(BRAND_TEXT).fontSize(16).font('Helvetica-Bold');
        doc.text('TOTAL GÉNÉRAL :', 60, rowY + 12, { continued: true })
           .text(`${Number(invoice.total).toFixed(2)} ${invoice.devise}`, { align: 'right' });
        
        doc.y = rowY + 55;
        doc.fillColor('black').font('Helvetica').fontSize(9);
        
        // Footer
        doc.moveDown(2);
        doc.fontSize(10).fillColor('#64748b')
           .text('━'.repeat(60), { align: 'center' });
        doc.fontSize(9).text("La marchandise vendue n'est ni reprise ni échangée", { align: 'center' });
        doc.text('Merci de votre confiance - Eraste Business SARL', { align: 'center' });
        doc.fontSize(8).fillColor('#9ca3af')
           .text('Marché MITENDI - RDC', { align: 'center' });
        
      }else{
        // Format ticket - amélioration de la mise en page
        const ticketHeight = Math.max(280, 320 + lines.length * 18);
        doc = new PDFDocument({ size: [ticketWidthPts, ticketHeight], margin: 10 });
        if (fontPath) try{ doc.font(fontPath); } catch(e){}
        
        // Header avec bordure dorée
        doc.rect(0, 0, doc.page.width, 55).fill(BRAND_PRIMARY);
        doc.rect(0, 55, doc.page.width, 2).fill(BRAND_GOLD);
        
        doc.fillColor(BRAND_TEXT).fontSize(12).font('Helvetica-Bold')
           .text('Eraste Business SARL', 0, 12, { align: 'center', width: doc.page.width });
        doc.fontSize(8).font('Helvetica')
           .text('Marché MITENDI', 0, 28, { align: 'center', width: doc.page.width });
        doc.fontSize(7).text('RDC - Service PME', 0, 40, { align: 'center', width: doc.page.width });
        
        doc.y = 65;
        doc.fillColor('black').font('Helvetica').fontSize(8);
        
        // Info facture
        doc.font('Helvetica-Bold').text(`Facture N° ${invoice.numero_facture}`, { align: 'center' });
        doc.font('Helvetica').fontSize(7);
        doc.text(`${invoice.date_emission} - ${invoice.heure_emission}`, { align: 'center' });
        doc.text(`Client: ${invoice.nom_client}`, { align: 'center' });
        if (req.user && req.user.full_name) {
          doc.text(`Gérant: ${req.user.full_name}`, { align: 'center' });
        }
        
        doc.moveDown(0.5);
        doc.text('─'.repeat(32), { align: 'center' });
        doc.moveDown(0.3);
        
        // Articles
        doc.fontSize(8);
        lines.forEach(l => {
          doc.font('Helvetica-Bold').text(`${l.numero_ordre}. ${l.designation}`);
          doc.font('Helvetica')
             .text(`   ${l.quantite} x ${Number(l.prix_unitaire).toFixed(2)} = ${Number(l.montant).toFixed(2)} ${invoice.devise}`, { align: 'right' });
        });
        
        doc.moveDown(0.3);
        doc.text('─'.repeat(32), { align: 'center' });
        doc.moveDown(0.3);
        
        // Total
        doc.fontSize(11).font('Helvetica-Bold').fillColor(BRAND_GOLD);
        doc.text(`TOTAL: ${Number(invoice.total).toFixed(2)} ${invoice.devise}`, { align: 'center' });
        
        doc.fillColor('black').font('Helvetica').fontSize(7);
        doc.moveDown(0.5);
        doc.text("Vente sans reprise ni échange", { align: 'center' });
        doc.text('Merci et à bientôt!', { align: 'center' });
      }

      // QR code as dataURL
      const qrText = JSON.stringify({ id: invoice.id, numero: invoice.numero_facture, total: invoice.total });
      try{
        const dataUrl = await QRCode.toDataURL(qrText);
        const base64 = dataUrl.split(',')[1];
        const img = Buffer.from(base64, 'base64');
        
        if(format === 'a4'){
          // QR Code pour A4 - en bas à droite
          const qrSize = 80;
          doc.image(img, doc.page.width - qrSize - 60, doc.page.height - qrSize - 60, { width: qrSize });
          doc.fontSize(7).fillColor('#9ca3af')
             .text('Scannez pour vérifier', doc.page.width - 140, doc.page.height - 50, { width: 80, align: 'center' });
        }else{
          // QR Code pour ticket - centré en bas
          const qrSize = Math.min(60, doc.page.width - 20);
          const imgX = (doc.page.width - qrSize) / 2;
          doc.moveDown(0.5);
          doc.image(img, imgX, doc.y, { width: qrSize });
          doc.y += qrSize + 5;
          doc.fontSize(6).fillColor('#9ca3af')
             .text('Code de vérification', { align: 'center' });
        }
      }catch(e){ console.error('QR generation error:', e); }
      
      doc.pipe(res);
      doc.end();
    });
  });
});

// Preview endpoint removed for security — use the protected `/api/invoices/:id/pdf` route instead.

const PORT = process.env.PORT || 4000;
// Serve frontend production build (if exists) so the whole app is available under backend URL
try{
  const fs = require('fs');
  const distPath = path.join(__dirname, '..', 'frontend', 'dist');
  if (fs.existsSync(distPath)){
    app.use(express.static(distPath));
    // serve index.html for any non-API route (SPA)
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving frontend from', distPath);
  }
}catch(e){
  console.warn('Could not enable static frontend serving:', e.message);
}

app.listen(PORT, () => console.log(`Backend started on http://localhost:${PORT}`));
