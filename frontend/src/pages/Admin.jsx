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
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')

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

  function generatePrintPreview(){
    const filtered = invoices.filter(inv=>{
      if(!filter) return true
      const q = filter.toLowerCase()
      return (inv.nom_client||'').toLowerCase().includes(q) || (inv.numero_facture||'').toLowerCase().includes(q) || String(inv.id_vendeur||'').includes(q)
    })
    const totalGeneral = filtered.reduce((sum, inv) => sum + Number(inv.total || 0), 0)
    
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #1e40af; text-align: center; border-bottom: 3px solid #f59e0b; padding-bottom: 10px; }
            .meta { text-align: center; color: #64748b; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: linear-gradient(135deg, #1e40af, #1e3a8a); color: white; padding: 12px; text-align: left; font-size: 12px; }
            td { padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
            tr:hover { background: #f8fafc; }
            .total-row { background: linear-gradient(90deg, #fffbeb, #fef3c7); font-weight: 800; font-size: 14px; border-top: 3px solid #f59e0b; }
            .total-row td { padding: 15px 10px; color: #1e3a8a; }
            .badge { background: #10b981; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <h1>🏢 Ets Eraste Business SARL - Base de données</h1>
          <div class="meta">
            <strong>Historique des factures</strong><br/>
            Généré le ${new Date().toLocaleString('fr-FR')}<br/>
            Nombre de factures: <span class="badge">${filtered.length}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Numéro</th>
                <th>Date</th>
                <th>Client</th>
                <th>Vendeur</th>
                <th>Total</th>
                <th>Devise</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(inv => `
                <tr>
                  <td>${inv.id}</td>
                  <td><strong>${inv.numero_facture}</strong></td>
                  <td>${inv.date_emission} ${inv.heure_emission}</td>
                  <td>${inv.nom_client}</td>
                  <td>#${inv.id_vendeur}</td>
                  <td style="text-align: right; font-weight: 600;">${Number(inv.total).toFixed(2)}</td>
                  <td>${inv.devise}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="5" style="text-align: right;"><strong>📊 TOTAL GÉNÉRAL:</strong></td>
                <td style="text-align: right; font-size: 16px;">${totalGeneral.toFixed(2)}</td>
                <td><strong>CDF</strong></td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `
    setPreviewHtml(html)
    setShowPrintPreview(true)
  }

  if(!authed) return (
    <div className="admin-login-page">
      <div className="admin-login-background">
        <div className="admin-login-pattern"></div>
      </div>
      <header className="admin-login-header">
        <img src="/logo-ministere.svg" alt="Ministère" className="logo left" />
        <div className="admin-header-text">
          <h1>🚪 Accès Administration</h1>
          <p>Espace réservé aux administrateurs autorisés</p>
        </div>
        <img src="/logo-eraste.svg" alt="Eraste Business" className="logo right" />
      </header>
      <main className="admin-login-main">
        <div className="admin-login-card">
          <div className="admin-card-icon">
            <div className="icon-circle">
              <span className="shield-icon">🛡️</span>
            </div>
          </div>
          <h2>Authentification Administrateur</h2>
          <p className="admin-subtitle">Veuillez entrer le mot de passe administrateur pour accéder au tableau de bord</p>
          <form className="admin-login-form" onSubmit={(e) => { e.preventDefault(); loginAdmin(); }}>
            <div className="form-group-admin">
              <label htmlFor="admin-password">🔑 Mot de passe administrateur</label>
              <div className="input-with-icon">
                <span className="input-icon">🔒</span>
                <input 
                  id="admin-password"
                  className="input input-admin" 
                  type="password" 
                  placeholder="Entrez le mot de passe sécurisé" 
                  value={password} 
                  onChange={e=>setPassword(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && loginAdmin()}
                />
              </div>
            </div>
            <button className="btn btn-gold btn-admin" type="submit">
              <span className="btn-text">✨ Se connecter en tant qu'Admin</span>
              <span className="btn-arrow">→</span>
            </button>
          </form>
          <div className="admin-security-note">
            <span className="security-icon">⚠️</span>
            <span>Accès protégé - Toutes les actions sont enregistrées</span>
          </div>
        </div>
      </main>
      <footer className="admin-login-footer">
        <div>🔒 Connexion sécurisée SSL | © Eraste Business SARL - 2025</div>
        <button className="btn-back-home" onClick={() => navigate('/')}>← Retour à l'accueil</button>
      </footer>
    </div>
  )

  return (
    <div className="app-container pad-20">
      <header className="invoice-header">
        <img src="/logo-ministere.svg" alt="Ministère" className="logo left" />
        <h2>Base de données - Historique des factures</h2>
        <img src="/logo-eraste.svg" alt="Eraste Business" className="logo right" />
      </header>
      <div className="admin-controls">
        <input className="filter-input" placeholder="Recherche par client, numéro, vendeur" value={filter} onChange={e=>setFilter(e.target.value)} />
        <input className="filter-input" type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} />
        <input className="filter-input" type="date" value={toDate} onChange={e=>setToDate(e.target.value)} />
        <button className="btn btn-ghost" onClick={fetchInvoices}>Actualiser</button>
        <button className="btn btn-primary" onClick={generatePrintPreview}>🖨️ Aperçu PDF avant impression</button>
        <button className="btn btn-gold ml-12" onClick={fetchSellerCredentials}>🔑 Mot de passe vendeur (1x)</button>
      </div>

      <div className="card">
        <table className="lines-table">
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
                  <button className="btn btn-danger ml-8" onClick={()=>del(inv.id)}>Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-general-row">
              <td colSpan="5" style={{textAlign:'right', fontWeight:700, fontSize:'16px', padding:'15px'}}>📊 TOTAL GÉNÉRAL:</td>
              <td style={{fontWeight:800, fontSize:'18px', color:'var(--primary-900)', padding:'15px'}}>
                {invoices.filter(inv=>{
                  if(!filter) return true
                  const q = filter.toLowerCase()
                  return (inv.nom_client||'').toLowerCase().includes(q) || (inv.numero_facture||'').toLowerCase().includes(q) || String(inv.id_vendeur||'').includes(q)
                }).reduce((sum, inv) => sum + Number(inv.total || 0), 0).toFixed(2)} CDF
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      {showPrintPreview && (
        <div role="dialog" aria-modal="true" className="modal-backdrop" onClick={()=>setShowPrintPreview(false)}>
          <div className="modal-content" style={{width:'90%', height:'90%'}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div style={{fontWeight:600}}>📄 Aperçu de la base de données</div>
              <div>
                <button className="btn btn-gold mr-8" onClick={()=>{
                  const iframe = document.querySelector('#print-preview-frame')
                  if(iframe && iframe.contentWindow){
                    iframe.contentWindow.print()
                  }
                }}>🖨️ Imprimer</button>
                <button className="btn btn-ghost" onClick={()=>setShowPrintPreview(false)}>Fermer</button>
              </div>
            </div>
            <iframe id="print-preview-frame" srcDoc={previewHtml} className="iframe-full" style={{border:'1px solid #e5e7eb', borderRadius:'8px'}} />
          </div>
        </div>
      )}
      {showSellerModal && sellerCred && (
        <div role="dialog" aria-modal="true" className="modal-backdrop" onClick={()=>setShowSellerModal(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <h3>Credentials vendeur du jour</h3>
            <p><strong>Utilisateur:</strong> {sellerCred.username}</p>
            <p><strong>Mot de passe (une seule affichage):</strong> <code className="code-snippet">{sellerCred.password}</code></p>
            <p className="text-danger">Ce mot de passe a été supprimé du fichier de secrets après lecture. Conservez-le en lieu sûr.</p>
            <div className="text-right">
              <button className="btn btn-ghost" onClick={()=>{ setShowSellerModal(false); setSellerCred(null); }}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
