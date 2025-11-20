import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useParams } from 'react-router-dom'
import QRCode from 'react-qr-code'

export default function TicketView(){
  const { id } = useParams()
  const [inv, setInv] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [loadingPdf, setLoadingPdf] = useState(false)
  useEffect(()=>{
    axios.get(`http://localhost:4000/api/invoices/${id}`).then(r=>setInv(r.data)).catch(()=>{})
  },[id])

  useEffect(()=>{
    return () => {
      if(pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  },[pdfUrl])

  if(!inv) return <div>Chargement...</div>

  return (
    <div className="ticket" style={{width:'220px', margin:'0 auto', fontFamily:'monospace'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontWeight:'bold'}}>Ets Eraste Business SARL</div>
        <div>Marché MITENDI</div>
      </div>
      <hr />
      <div>
        <div>Facture N° : {inv.numero_facture}</div>
        <div>Date : {inv.date_emission}</div>
        <div>Heure : {inv.heure_emission}</div>
        <div>Client : {inv.nom_client}</div>
      </div>
      <hr />
      <div>
        {inv.lines.map(l=> (
          <div key={l.id} style={{display:'flex', justifyContent:'space-between'}}>
            <div>{l.numero_ordre}. {l.designation}</div>
            <div>{l.quantite} x {Number(l.prix_unitaire).toFixed(2)}</div>
            <div>{Number(l.montant).toFixed(2)}</div>
          </div>
        ))}
      </div>
      <hr />
      <div style={{textAlign:'right', fontWeight:'bold'}}>Total : {Number(inv.total).toFixed(2)} {inv.devise}</div>
      <hr />
      <div style={{textAlign:'center', fontSize:'12px'}}>
        <div>La marchandise vendue n'est ni reprise ni échangée</div>
        <div>Merci et à la prochaine</div>
        <div>Payé cash</div>
      </div>
      <div style={{textAlign:'center', marginTop:12}}>
        <QRCode value={JSON.stringify({id:inv.id, numero:inv.numero_facture, total:inv.total})} size={80} />
      </div>
      <div style={{textAlign:'center', marginTop:8}}>
        <button onClick={()=>window.print()}>Imprimer la facture</button>
        <button onClick={async ()=>{
          setLoadingPdf(true)
          try{
            const resp = await fetch(`http://localhost:4000/api/invoices/${id}/pdf`, { credentials: 'include' });
            if(!resp.ok){
              const err = await resp.json().catch(()=>({error:'Erreur'}));
              setLoadingPdf(false)
              return alert(err.error || 'Erreur lors de la génération du PDF')
            }
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            // set embedded url instead of opening a new tab
            if(pdfUrl) URL.revokeObjectURL(pdfUrl)
            setPdfUrl(url)
          }catch(e){
            alert('Erreur lors du téléchargement du PDF')
          }finally{ setLoadingPdf(false) }
        }} style={{marginLeft:8}}>{loadingPdf ? 'Chargement...' : 'Afficher PDF intégré'}</button>
        <button onClick={async ()=>{
          // fallback: download file in new tab
          try{
            const resp = await fetch(`http://localhost:4000/api/invoices/${id}/pdf`, { credentials: 'include' });
            if(!resp.ok) return alert('Erreur lors de la génération du PDF')
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(()=> URL.revokeObjectURL(url), 60_000);
          }catch(e){ alert('Erreur lors du téléchargement du PDF') }
        }} style={{marginLeft:8}}>Télécharger PDF</button>
      </div>

      {pdfUrl && (
        <div style={{marginTop:20, textAlign:'center'}}>
          <div style={{marginBottom:8}}>PDF intégré :</div>
          <iframe title="facture-pdf" src={pdfUrl} style={{width:'100%', height:600, border:'1px solid #ddd'}} />
        </div>
      )}
    </div>
  )
}
