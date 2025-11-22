const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

(async () => {
  try{
    const dbFile = path.join(__dirname, '..', 'data.db');
    const db = new sqlite3.Database(dbFile);

    const dateSuffix = new Date().toISOString().slice(0,10).replace(/-/g,''); // YYYYMMDD
    const username = `vendeur_${dateSuffix}`;
    // generate a random password (hex, 12 chars)
    const crypto = require('crypto');
    const plain = crypto.randomBytes(6).toString('hex');
    const saltRounds = 10;

    // check if username exists
    const existing = await new Promise((res, rej) => db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => err ? rej(err) : res(row)));
    const hash = await bcrypt.hash(plain, saltRounds);
    if(existing){
      // update password for existing seller
      await new Promise((res, rej) => db.run('UPDATE users SET password = ? WHERE id = ?', [hash, existing.id], function(err){ if(err) return rej(err); res(this.changes); }));
      console.log(`Utilisateur existant mis à jour: ${username}`);
    }else{
      await new Promise((res, rej) => db.run('INSERT INTO users (username,password,role,full_name) VALUES (?,?,?,?)', [username, hash, 'vendeur', 'Vendeur du jour'], function(err){
        if(err) return rej(err); res(this.lastID);
      }));
      console.log(`Utilisateur créé: ${username}`);
    }

    // write credentials to backend/.secrets (non commited)
    try{
      const fs = require('fs');
      const outPath = path.join(__dirname, '..', '.secrets');
      let data = {};
      if (fs.existsSync(outPath)){
        try{ data = JSON.parse(fs.readFileSync(outPath,'utf8')||'{}'); }catch(e){ data = {}; }
      }
      data[username] = { password: plain, createdAt: new Date().toISOString() };
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2), { mode: 0o600 });
      console.log('Credentials sauvegardées dans', outPath);
    }catch(e){ console.warn('Impossible d\'écrire backend/.secrets:', e.message); }
    process.exit(0);
  }catch(err){
    console.error('Erreur:', err);
    process.exit(1);
  }
})();
