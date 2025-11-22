const admin = require('firebase-admin');
const bcrypt = require('bcrypt');

// Initialize Firebase (use your service account)
const serviceAccount = require('./firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function initializeData() {
  console.log('🔄 Initialisation de Firebase...');

  // Create admin user
  const adminHash = await bcrypt.hash('admin123', 10);
  await db.collection('users').add({
    username: 'admin',
    password_hash: adminHash,
    full_name: 'Administrateur',
    role: 'admin',
    created_at: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log('✓ Admin créé');

  // Create seller user
  const sellerHash = await bcrypt.hash('vendeur123', 10);
  await db.collection('users').add({
    username: 'vendeur_2025',
    password_hash: sellerHash,
    full_name: 'Vendeur Principal',
    role: 'vendeur',
    created_at: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log('✓ Vendeur créé');

  console.log('\n📋 Identifiants de connexion:');
  console.log('Admin: admin / admin123');
  console.log('Vendeur: vendeur_2025 / vendeur123');
  
  process.exit(0);
}

initializeData().catch(console.error);
