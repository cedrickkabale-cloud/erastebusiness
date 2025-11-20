import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

export default function Admin(){
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState([])
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [filter, setFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sellerCred, setSellerCred] = useState(null)
  const [showSellerModal, setShowSellerModal] = useState(false)

  async function loginAdmin(){
    // simple client-side gate: call login endpoint with admin credentials
    try{
      const res = await axios.post('http://localhost:4000/api/login', { username: 'admin', password }, { withCredentials: true })
      // cookie httpOnly is set by server; store user minimal info
      localStorage.setItem('user', JSON.stringify(res.data.user))
      setAuthed(true)
      fetchInvoices()
    }catch(err){
      alert('Auth admin failed')
    }
  }

  function fetchInvoices(){
    axios.get('http://localhost:4000/api/invoices', { withCredentials: true }).then(r=>setInvoices(r.data))
  }

  async function del(id){
    if(!confirm('Êtes-vous sûr de vouloir supprimer cette facture ? Cette action est irréversible.')) return
    const token = localStorage.getItem('token')
    await axios.delete(`http://localhost:4000/api/invoices/${id}`, { withCredentials: true })
    fetchInvoices()
  }

  async function fetchSellerCredentials(){
    try{
      const resp = await axios.get('http://localhost:4000/api/admin/seller-credentials', { withCredentials: true })
      setSellerCred(resp.data)
      setShowSellerModal(true)
    }catch(err){
      const msg = err?.response?.data?.error || 'Erreur lors de la récupération des credentials'
      alert(msg)
    }
  }

  if(!authed) return (
    <div style={{padding:20}}>
      <h3>Login administrateur</h3>
      <input type="password" placeholder="Mot de passe admin" value={password} onChange={e=>setPassword(e.target.value)} />
      <button onClick={loginAdmin}>Se connecter</button>
    </div>
  )

  return (
    <div style={{padding:20}} className="app-container">
      <h2>Base de données - Historique des factures</h2>
      <div className="admin-controls">
        <input className="filter-input" placeholder="Recherche par client, numéro, vendeur" value={filter} onChange={e=>setFilter(e.target.value)} />
        <input className="filter-input" type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} />
        <input className="filter-input" type="date" value={toDate} onChange={e=>setToDate(e.target.value)} />
        <button className="btn btn-ghost" onClick={fetchInvoices}>Actualiser</button>
        <button className="btn btn-primary" onClick={()=>window.print()}>Imprimer la base</button>
        <button className="btn btn-warning" onClick={fetchSellerCredentials} style={{marginLeft:12}}>Afficher mot de passe vendeur du jour (1x)</button>
      </div>

      <div className="card">
        <table className="lines-table" style={{width:'100%'}}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Numéro</th>
              <th>Date</th>
              <th>Client</th>
              <th>Vendeur</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.filter(inv=>{
              if(!filter) return true
              const q = filter.toLowerCase()
              return (inv.nom_client||'').toLowerCase().includes(q) || (inv.numero_facture||'').toLowerCase().includes(q) || String(inv.id_vendeur||'').includes(q)
            }).map(inv=> (
              <tr key={inv.id}>
                <td>{inv.id}</td>
                <td>{inv.numero_facture}</td>
                <td>{inv.date_emission} {inv.heure_emission}</td>
                <td>{inv.nom_client}</td>
                <td>{inv.id_vendeur}</td>
                <td>{Number(inv.total).toFixed(2)} {inv.devise}</td>
                <td>
                  <button className="btn btn-ghost" onClick={()=>navigate(`/ticket/${inv.id}`)}>Voir</button>
                  <button className="btn btn-danger" style={{marginLeft:8}} onClick={()=>del(inv.id)}>Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showSellerModal && sellerCred && (
        <div role="dialog" aria-modal="true" style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center'}} onClick={()=>setShowSellerModal(false)}>
          <div style={{background:'#fff', padding:20, borderRadius:8, minWidth:340}} onClick={e=>e.stopPropagation()}>
            <h3>Credentials vendeur du jour</h3>
            <p><strong>Utilisateur:</strong> {sellerCred.username}</p>
            <p><strong>Mot de passe (une seule affichage):</strong> <code style={{background:'#f4f4f4', padding:6, borderRadius:4}}>{sellerCred.password}</code></p>
            <p style={{color:'#a00'}}>Ce mot de passe a été supprimé du fichier de secrets après lecture. Conservez-le en lieu sûr.</p>
            <div style={{textAlign:'right'}}>
              <button onClick={()=>{ setShowSellerModal(false); setSellerCred(null); }}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
