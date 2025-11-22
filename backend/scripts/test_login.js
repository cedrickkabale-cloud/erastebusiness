(async ()=>{
  try{
    const fetch = global.fetch || (await import('node-fetch')).default;
    const url = 'http://localhost:4000/api/login';
    const body = { username: 'gerant', password: 'password' };
    const resp = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: {'Content-Type':'application/json'}, redirect: 'manual' });
    console.log('Status', resp.status);
    const text = await resp.text();
    console.log('Body:', text);
    console.log('Headers:');
    for(const [k,v] of resp.headers.entries()) console.log(k+':', v);
  }catch(e){ console.error(e); process.exit(1); }
})();
