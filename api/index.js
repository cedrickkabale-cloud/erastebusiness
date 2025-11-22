const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(express.json());
app.use(cookieParser());

// CORS for Vercel
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Database
const dbPath = process.env.VERCEL 
  ? '/tmp/data.db' 
  : path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

// Initialize DB
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'vendeur'
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_facture TEXT UNIQUE,
    nom_client TEXT,
    date_emission TEXT,
    heure_emission TEXT,
    id_vendeur INTEGER,
    total REAL,
    devise TEXT DEFAULT 'CDF',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS invoice_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER,
    numero_ordre INTEGER,
    designation TEXT,
    quantite INTEGER,
    prix_unitaire REAL,
    montant REAL,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
  )`);
});

const JWT_SECRET = process.env.JWT_SECRET || 'eraste-secret-key-2025';

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Token invalide' });
  }
}

// Routes
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Identifiants incorrects' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });
    
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
    res.json({ user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
  });
});

app.get('/api/me', authMiddleware, (req, res) => {
  db.get('SELECT id, username, full_name, role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ user });
  });
});

app.get('/api/seller-of-day', (req, res) => {
  db.get(`SELECT id, username, full_name FROM users WHERE role = 'vendeur' ORDER BY id DESC LIMIT 1`, (err, user) => {
    if (err || !user) return res.json({});
    res.json(user);
  });
});

app.get('/api/invoices', authMiddleware, (req, res) => {
  db.all('SELECT * FROM invoices ORDER BY created_at DESC', (err, invoices) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(invoices);
  });
});

app.post('/api/invoices', authMiddleware, (req, res) => {
  const { nom_client, date_emission, heure_emission, lines, total, devise } = req.body;
  const numero_facture = `INV-${Date.now()}`;
  
  db.run('INSERT INTO invoices (numero_facture, nom_client, date_emission, heure_emission, id_vendeur, total, devise) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [numero_facture, nom_client, date_emission, heure_emission, req.user.id, total, devise],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const invoiceId = this.lastID;
      
      const stmt = db.prepare('INSERT INTO invoice_lines (invoice_id, numero_ordre, designation, quantite, prix_unitaire, montant) VALUES (?, ?, ?, ?, ?, ?)');
      lines.forEach(l => {
        stmt.run(invoiceId, l.numero_ordre, l.designation, l.quantite, l.prix_unitaire, l.montant);
      });
      stmt.finalize();
      
      res.json({ id: invoiceId, numero_facture });
    }
  );
});

app.get('/api/invoices/:id', (req, res) => {
  db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id], (err, invoice) => {
    if (err || !invoice) return res.status(404).json({ error: 'Facture introuvable' });
    db.all('SELECT * FROM invoice_lines WHERE invoice_id = ?', [req.params.id], (err2, lines) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ...invoice, lines });
    });
  });
});

app.delete('/api/invoices/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  db.run('DELETE FROM invoices WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/admin/seller-credentials', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  db.get(`SELECT username, full_name FROM users WHERE role = 'vendeur' ORDER BY id DESC LIMIT 1`, (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'Vendeur introuvable' });
    res.json({ username: user.username, full_name: user.full_name, password: '(mot de passe hashé)' });
  });
});

module.exports = app;
