import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

function emptyLine(i, invoiceNumero){
  return { id: Date.now() + i, numero_ordre: i+1, invoiceNumero, designation: '', quantite: 1, prix_unitaire: 0, montant: 0 }
}

export default function InvoiceForm(){
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  useEffect(()=>{ if(!user) navigate('/') },[])

  const [nomClient, setNomClient] = useState('')
  const [dateEmission, setDateEmission] = useState(new Date().toISOString().slice(0,10))
  const [heureEmission, setHeureEmission] = useState(new Date().toLocaleTimeString().slice(0,5))
  const [lines, setLines] = useState([emptyLine(0)])
  const [devise, setDevise] = useState('CDF')
  const [taux, setTaux] = useState(2000) // 1 USD = 2000 CDF par défaut
  const [message, setMessage] = useState(null)
  const [invoiceNumero, setInvoiceNumero] = useState('—')

  useEffect(()=>{ recalc() },[lines])

  function recalc(){
    setLines(prev => prev.map(l => ({...l, montant: Number(l.quantite || 0) * Number(l.prix_unitaire || 0)})))
  }

  function addLine(){
    setLines(prev => [...prev, emptyLine(prev.length)])
  }

  function removeLine(idx){
    setLines(prev => prev.filter((_,i)=>i!==idx).map((l,i)=>({ ...l, numero_ordre: i+1 })))
  }

  function updateLine(idx, key, value){
    const copy = [...lines]
    copy[idx] = {...copy[idx], [key]: value}
    copy[idx].montant = Number(copy[idx].quantite || 0) * Number(copy[idx].prix_unitaire || 0)
    setLines(copy)
  }

  const total = lines.reduce((s,l)=>s + Number(l.montant || 0), 0)

  async function validate(){
    if(!nomClient) return setMessage('Nom du client requis')
    if(lines.length===0) return setMessage('Ajoutez au moins un article')
    const payload = {
      nom_client: nomClient,
      date_emission: dateEmission,
      heure_emission: heureEmission,
      id_vendeur: user?.id,
      total,
      devise,
      taux_conversion: taux,
      lines: lines.map(l=>({ numero_ordre: l.numero_ordre, designation: l.designation, quantite: l.quantite, prix_unitaire: l.prix_unitaire, montant: l.montant }))
    }
    try{
      const res = await axios.post('/api/invoices', payload)
      // server will set cookie; but with axios defaults, credentials are sent
      // note: we keep using axios.defaults.withCredentials = true
      setMessage('Facture enregistrée avec succès.')
      setInvoiceNumero(res.data.numero_facture || invoiceNumero)
      navigate(`/ticket/${res.data.id}`)
    }catch(err){
      setMessage(err?.response?.data?.error || 'Erreur lors de l\'enregistrement')
    }
  }

  return (
    <div className="invoice-page app-container">
      <header className="invoice-header">
        <img src="/logo-ministere.svg" alt="Ministère" className="logo left" />
        <h1>📄 Création de Facture</h1>
        <img src="/logo-eraste.svg" alt="Eraste Business" className="logo right" />
      </header>
      
      <div className="invoice-info-bar">
        <div className="info-item">
          <span className="info-label">👤 Vendeur</span>
          <span className="info-value">{user?.full_name || '—'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">📋 Facture N°</span>
          <span className="info-value badge badge-info">{invoiceNumero}</span>
        </div>
        <div className="info-item">
          <span className="info-label">📅 Date</span>
          <span className="info-value">{new Date(dateEmission).toLocaleDateString('fr-FR')} • {heureEmission}</span>
        </div>
      </div>

      <div className="card">
        <div className="form-section">
          <h3 className="section-title">📝 Informations Client</h3>
          <div className="form-row">
            <div className="form-group-full">
              <label>👤 Nom complet du client</label>
              <input className="input input-premium" placeholder="Entrez le nom du client..." value={nomClient} onChange={e=>setNomClient(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3 className="section-title">⚙️ Configuration de la facture</h3>
          <div className="form-row">
            <div>
              <label>📅 Date d'émission</label>
              <input className="input" type="date" value={dateEmission} onChange={e=>setDateEmission(e.target.value)} />
            </div>
            <div>
              <label>🕐 Heure d'émission</label>
              <input className="input" value={heureEmission} onChange={e=>setHeureEmission(e.target.value)} />
            </div>
            <div>
              <label>💰 Devise</label>
              <select className="input" value={devise} onChange={e=>setDevise(e.target.value)}>
                <option value="CDF">🇨🇩 CDF - Franc Congolais</option>
                <option value="USD">🇺🇸 USD - Dollar Américain</option>
              </select>
            </div>
            <div>
              <label>📊 Taux de change (1 USD)</label>
              <input className="input" type="number" placeholder="2000" value={taux} onChange={e=>setTaux(Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="section-header">
            <h3 className="section-title">🛒 Articles et Services</h3>
            <button className="btn btn-success" onClick={addLine}>➕ Nouvelle ligne</button>
          </div>

          <div className="lines-container">
            <table className="lines-table-modern">
              <thead>
                <tr>
                  <th className="col-no">N°</th>
                  <th className="col-desc">📦 Désignation</th>
                  <th className="col-qty">🔢 Qté</th>
                  <th className="col-price">💵 Prix unitaire</th>
                  <th className="col-amt">💰 Montant</th>
                  <th className="col-actions">⚡</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i)=> (
                  <tr key={l.id} className="line-row-modern">
                    <td className="line-number">{i+1}</td>
                    <td><input className="input input-table" placeholder="Description de l'article..." value={l.designation} onChange={e=>updateLine(i,'designation', e.target.value)} /></td>
                    <td><input className="input input-table input-center" type="number" min="1" value={l.quantite} onChange={e=>updateLine(i,'quantite', Number(e.target.value))} /></td>
                    <td><input className="input input-table input-right" type="number" min="0" step="0.01" value={l.prix_unitaire} onChange={e=>updateLine(i,'prix_unitaire', Number(e.target.value))} /></td>
                    <td className="amount-cell">{Number(l.montant).toFixed(2)} {devise}</td>
                    <td className="line-actions">
                      <button className="btn-icon btn-danger-icon" onClick={()=>removeLine(i)} title="Supprimer">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="invoice-totals">
          <div className="totals-grid">
            <div className="total-row">
              <span className="total-label">Sous-total</span>
              <span className="total-value">{total.toFixed(2)} {devise}</span>
            </div>
            <div className="total-row conversion">
              <span className="total-label">💱 Équivalence</span>
              <span className="total-value-small">
                {devise === 'USD' ? `≈ ${(total * taux).toFixed(2)} CDF` : `≈ ${(total / taux).toFixed(2)} USD`}
              </span>
            </div>
            <div className="total-row grand-total">
              <span className="total-label">💎 TOTAL GÉNÉRAL</span>
              <span className="total-value-grand">{total.toFixed(2)} {devise}</span>
            </div>
          </div>
        </div>

        <div className="form-actions-footer">
          <button className="btn btn-ghost btn-large" onClick={()=>navigate('/')}>❌ Annuler</button>
          <button className="btn btn-gold btn-large" onClick={validate}>✅ Enregistrer & Imprimer la facture</button>
        </div>
      </div>
      {message && <div className="message-box">{message}</div>}
    </div>
  )
}
