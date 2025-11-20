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
      const res = await axios.post('http://localhost:4000/api/invoices', payload)
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
      <h1>Formulaire du reçu</h1>
      <div className="card">
        <div className="form-row">
          <div>
            <label>Nom du client</label>
            <input value={nomClient} onChange={e=>setNomClient(e.target.value)} />
          </div>
          <div>
            <label>Date</label>
            <input type="date" value={dateEmission} onChange={e=>setDateEmission(e.target.value)} />
            <label>Heure</label>
            <input value={heureEmission} onChange={e=>setHeureEmission(e.target.value)} />
          </div>
          <div>
            <label>Vendeur</label>
            <input value={user?.full_name || ''} readOnly />
            <label>Numéro facture</label>
            <input value={invoiceNumero} readOnly />
          </div>
        </div>

        <div style={{marginTop:12}} className="form-row">
          <div>
            <label>Devise</label>
            <select value={devise} onChange={e=>setDevise(e.target.value)}>
              <option value="CDF">CDF</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label>Taux (1 USD = X CDF)</label>
            <input type="number" value={taux} onChange={e=>setTaux(Number(e.target.value))} />
          </div>
          <div style={{display:'flex', alignItems:'end', gap:8}}>
            <button className="btn btn-ghost" onClick={addLine}>+ Ajouter ligne</button>
            <button className="btn btn-primary" onClick={validate}>Valider la facture</button>
          </div>
        </div>

        <table className="lines-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Désignation</th>
              <th style={{width:120}}>Quantité</th>
              <th style={{width:140}}>Prix unitaire</th>
              <th style={{width:120}}>Montant</th>
              <th style={{width:120}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i)=> (
              <tr key={l.id}>
                <td>{i+1}</td>
                <td><input value={l.designation} onChange={e=>updateLine(i,'designation', e.target.value)} /></td>
                <td><input type="number" value={l.quantite} onChange={e=>updateLine(i,'quantite', Number(e.target.value))} /></td>
                <td><input type="number" value={l.prix_unitaire} onChange={e=>updateLine(i,'prix_unitaire', Number(e.target.value))} /></td>
                <td>{Number(l.montant).toFixed(2)}</td>
                <td className="line-actions">
                  <button className="btn btn-ghost" onClick={()=>removeLine(i)}>Suppr</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals">
          <div className="summary">Total: {total.toFixed(2)} {devise}
            {devise === 'USD' ? <div style={{fontSize:12,color:'var(--muted)'}}>≈ {(total * taux).toFixed(2)} CDF</div> : <div style={{fontSize:12,color:'var(--muted)'}}>≈ {(total / taux).toFixed(2)} USD</div>}
          </div>
          <div>
            <button className="btn btn-ghost" onClick={()=>navigate('/')}>Annuler</button>
            <button className="btn btn-primary" style={{marginLeft:8}} onClick={validate}>Enregistrer & Imprimer</button>
          </div>
        </div>
      </div>
      {message && <div style={{marginTop:12}} className="card">{message}</div>}
    </div>
  )
}
