const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dbFile = path.join(__dirname, 'data.db');

const db = new sqlite3.Database(dbFile);

function init() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      full_name TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_facture TEXT UNIQUE,
      date_emission TEXT,
      heure_emission TEXT,
      nom_client TEXT,
      id_vendeur INTEGER,
      total REAL,
      devise TEXT,
      qr_data TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS invoice_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      numero_ordre INTEGER,
      designation TEXT,
      quantite REAL,
      prix_unitaire REAL,
      montant REAL,
      FOREIGN KEY(invoice_id) REFERENCES invoices(id)
    )`);

    // seed default users if not exists
    db.get("SELECT COUNT(*) as c FROM users", (err, row) => {
      if (!err && row && row.c === 0) {
        const bcrypt = require('bcrypt');
        const saltRounds = 10;

        // generate strong random passwords (hex, 32 chars)
        const adminPassword = crypto.randomBytes(16).toString('hex');
        const gerantPassword = crypto.randomBytes(16).toString('hex');

        const users = [
          { username: 'gerant', password: gerantPassword, role: 'vendeur', full_name: 'Gérant Eraste' },
          { username: 'admin', password: adminPassword, role: 'admin', full_name: 'Administrateur' }
        ];

        // hash & insert all users, then write the plaintext passwords to backend/.secrets
        const insertPromises = users.map(u => {
          return bcrypt.hash(u.password, saltRounds).then(hash => {
            return new Promise((resolve, reject) => {
              db.run(`INSERT OR IGNORE INTO users (username,password,role,full_name) VALUES (?,?,?,?)`, [u.username, hash, u.role, u.full_name], function(err) {
                if (err) return reject(err);
                resolve();
              });
            });
          });
        });

        Promise.all(insertPromises)
          .then(() => {
            try {
              const secretPath = path.join(__dirname, '.secrets');
              const data = {
                admin: { password: adminPassword, createdAt: new Date().toISOString() },
                gerant: { password: gerantPassword, createdAt: new Date().toISOString() }
              };
              fs.writeFileSync(secretPath, JSON.stringify(data, null, 2), { mode: 0o600 });
              console.log('Wrote initial credentials (JSON) to', secretPath);
            } catch (e) {
              console.error('Failed to write backend/.secrets with initial credentials:', e);
            }
          })
          .catch(e => console.error('Failed to seed default users:', e));
      }
    });
  });
}

module.exports = { db, init };
