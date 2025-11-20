const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data.db');

db.serialize(()=>{
  db.run("INSERT INTO invoices (numero_facture,date_emission,heure_emission,nom_client,id_vendeur,total,devise,qr_data) VALUES (?,?,?,?,?,?,?,?)", ['EB-2025-000001','2025-11-20','12:00','Client Test',1,1500,'CDF','{}'], function(err){
    if(err){ console.error('insert invoice error',err); process.exit(1);} 
    const id=this.lastID;
    db.run("INSERT INTO invoice_lines (invoice_id,numero_ordre,designation,quantite,prix_unitaire,montant) VALUES (?,?,?,?,?,?)", [id,1,'Produit A',2,500,1000], function(err2){
      if(err2){ console.error('line1 error',err2); process.exit(1);} 
      db.run("INSERT INTO invoice_lines (invoice_id,numero_ordre,designation,quantite,prix_unitaire,montant) VALUES (?,?,?,?,?,?)", [id,2,'Produit B',1,500,500], function(err3){
        if(err3){ console.error('line2 error',err3); process.exit(1);} 
        console.log('Inserted invoice id',id); 
        db.close();
      });
    });
  });
});
