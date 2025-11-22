const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

const dbFile = path.join(__dirname, '..', 'data.db');
const db = new sqlite3.Database(dbFile);

async function run() {
  try {
    const adminPassword = crypto.randomBytes(16).toString('hex');
    const gerantPassword = crypto.randomBytes(16).toString('hex');
    const saltRounds = 10;

    const adminHash = await bcrypt.hash(adminPassword, saltRounds);
    const gerantHash = await bcrypt.hash(gerantPassword, saltRounds);

    const upsert = `INSERT INTO users (username,password,role,full_name) VALUES (?,?,?,?) ON CONFLICT(username) DO UPDATE SET password=excluded.password, role=excluded.role, full_name=excluded.full_name`;

    await new Promise((resolve, reject) => {
      db.run(upsert, ['admin', adminHash, 'admin', 'Administrateur'], function(err) {
        if (err) return reject(err);
        resolve();
      });
    });

    await new Promise((resolve, reject) => {
      db.run(upsert, ['gerant', gerantHash, 'vendeur', 'Gérant Eraste'], function(err) {
        if (err) return reject(err);
        resolve();
      });
    });

    const secretsPath = path.join(__dirname, '..', '.secrets');
    const data = {
      admin: { password: adminPassword, createdAt: new Date().toISOString() },
      gerant: { password: gerantPassword, createdAt: new Date().toISOString() }
    };
    fs.writeFileSync(secretsPath, JSON.stringify(data, null, 2), { mode: 0o600 });
    console.log('Applied production credentials and wrote to', secretsPath);
    console.log('admin =>', adminPassword);
    console.log('gerant =>', gerantPassword);
    process.exit(0);
  } catch (e) {
    console.error('Failed to set production credentials:', e);
    process.exit(1);
  }
}

run();
