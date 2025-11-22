const sqlite3 = require('sqlite3').verbose();
const path = require('path');
(async ()=>{
  try{
    const dbFile = path.join(__dirname, '..', 'data.db');
    const db = new sqlite3.Database(dbFile);
    db.all('SELECT id, username, role, full_name FROM users ORDER BY id ASC', (err, rows)=>{
      if(err) { console.error('DB error', err); process.exit(1); }
      console.log('Users:');
      rows.forEach(r=> console.log(`${r.id}\t${r.username}\t${r.role}\t${r.full_name}`));
      process.exit(0);
    });
  }catch(e){ console.error(e); process.exit(1); }
})();
