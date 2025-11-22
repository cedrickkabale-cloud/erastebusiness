const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');

(async () => {
  try{
    const DB = path.join(__dirname, '..', 'data.db');
    const db = new sqlite3.Database(DB);
    const getUser = (username) => new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => err ? reject(err) : resolve(row));
    });

    const user = await getUser('gerant');
    if(!user) return console.error('Utilisateur gerant non trouvé');

    const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
    const payload = { id: user.id, username: user.username, role: user.role, full_name: user.full_name };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    const fetch = global.fetch || (await import('node-fetch')).default;
    const resp = await fetch('http://localhost:4000/api/invoices/1/pdf', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if(!resp.ok) return console.error('Erreur HTTP', resp.status);
    const arrayBuffer = await resp.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    const outDir = path.join(__dirname, '..', 'tmp');
    if(!fs.existsSync(outDir)) fs.mkdirSync(outDir);
    const outPath = path.join(outDir, 'invoice-1-protected.pdf');
    fs.writeFileSync(outPath, buf);
    console.log('PDF sauvegardé ->', outPath);

    // try to open file on Windows
    const child = require('child_process');
    child.exec('start "" "' + outPath.replace(/"/g,'\"') + '"');
    process.exit(0);
  }catch(err){
    console.error(err);
    process.exit(1);
  }
})();
