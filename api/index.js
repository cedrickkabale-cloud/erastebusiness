const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

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

// Initialize Firebase Admin
let db;
try {
  if (!admin.apps.length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
      ? JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString())
      : require('./firebase-key.json');
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  db = admin.firestore();
  console.log('✓ Firebase connected');
} catch (error) {
  console.error('Firebase initialization error:', error.message);
}

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
  try {
    const { username, password } = req.body;
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', username).limit(1).get();
    
    if (snapshot.empty) return res.status(401).json({ error: 'Identifiants incorrects' });
    
    const userDoc = snapshot.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });
    
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    res.json({ user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.id).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ user: { id: userDoc.id, ...userDoc.data() } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/seller-of-day', async (req, res) => {
  try {
    const snapshot = await db.collection('users').where('role', '==', 'vendeur').limit(1).get();
    if (snapshot.empty) return res.json({});
    const userDoc = snapshot.docs[0];
    res.json({ id: userDoc.id, ...userDoc.data() });
  } catch (error) {
    res.json({});
  }
});

app.get('/api/invoices', authMiddleware, async (req, res) => {
  try {
    const snapshot = await db.collection('invoices').orderBy('created_at', 'desc').get();
    const invoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/invoices', authMiddleware, async (req, res) => {
  try {
    const { nom_client, date_emission, heure_emission, lines, total, devise } = req.body;
    const numero_facture = `INV-${Date.now()}`;
    
    const invoiceData = {
      numero_facture,
      nom_client,
      date_emission,
      heure_emission,
      id_vendeur: req.user.id,
      total,
      devise: devise || 'CDF',
      lines,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('invoices').add(invoiceData);
    res.json({ id: docRef.id, numero_facture });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/invoices/:id', async (req, res) => {
  try {
    const docRef = await db.collection('invoices').doc(req.params.id).get();
    if (!docRef.exists) return res.status(404).json({ error: 'Facture introuvable' });
    res.json({ id: docRef.id, ...docRef.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/invoices/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
    await db.collection('invoices').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/seller-credentials', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
    const snapshot = await db.collection('users').where('role', '==', 'vendeur').limit(1).get();
    if (snapshot.empty) return res.status(404).json({ error: 'Vendeur introuvable' });
    const userDoc = snapshot.docs[0];
    const user = userDoc.data();
    res.json({ username: user.username, full_name: user.full_name, password: '(mot de passe hashé - voir console backend)' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = app;

// For local testing
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Serveur Firebase API démarré sur http://localhost:${PORT}`);
  });
}
