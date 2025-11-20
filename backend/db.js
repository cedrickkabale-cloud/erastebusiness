const sqlite3 = require('sqlite3').verbose();
const path = require('path');
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
        const users = [
          { username: 'gerant', password: 'password', role: 'vendeur', full_name: 'Gérant Eraste' },
          { username: 'admin', password: 'adminpass', role: 'admin', full_name: 'Administrateur' }
        ];
        users.forEach(u => {
          bcrypt.hash(u.password, saltRounds).then(hash => {
            db.run(`INSERT OR IGNORE INTO users (username,password,role,full_name) VALUES (?,?,?,?)`, [u.username, hash, u.role, u.full_name]);
          });
        });
      }
    });
  });
}

module.exports = { db, init };
