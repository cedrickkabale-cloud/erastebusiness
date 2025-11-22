import React, { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import { useParams } from 'react-router-dom'
import QRCode from 'react-qr-code'

export default function TicketView(){
  const { id } = useParams()
  const [inv, setInv] = useState(null)
  const [compact, setCompact] = useState(false)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const iframeRef = useRef(null)
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
    <div className={(compact ? 'ticket-compact ' : '') + 'ticket'}>
      <div className="ticket-header center">
        <div className="ticket-title">Ets Eraste Business SARL</div>
        <div className="ticket-sub">Marché MITENDI</div>
      </div>
      <hr />
      <div className="ticket-meta">
        <div>Facture N° : {inv.numero_facture}</div>
        <div>Date : {inv.date_emission}</div>
        <div>Heure : {inv.heure_emission}</div>
        <div>Client : {inv.nom_client}</div>
      </div>
      <hr />
      <div className="ticket-lines">
        {inv.lines.map(l=> (
          <div key={l.id} className="line-row">
            <div className="line-desc">{l.numero_ordre}. {l.designation}</div>
            <div className="line-q">{l.quantite} x {Number(l.prix_unitaire).toFixed(2)}</div>
            <div className="line-amt">{Number(l.montant).toFixed(2)}</div>
          </div>
        ))}
      </div>
      <hr />
      <div className="ticket-total">Total : {Number(inv.total).toFixed(2)} {inv.devise}</div>
      <hr />
      <div className="ticket-note center small">
        <div>La marchandise vendue n'est ni reprise ni échangée</div>
        <div>Merci et à la prochaine</div>
        <div style={{marginTop:8}}><span className="badge badge-gold">✓ Payé cash</span></div>
      </div>
      <div className="center mt-12">
        <QRCode value={JSON.stringify({id:inv.id, numero:inv.numero_facture, total:inv.total})} size={80} />
      </div>
      <div className="center mt-8">
        <button className="btn btn-ghost" onClick={()=>window.print()}>Imprimer la facture</button>
        <button className="btn btn-ghost ml-8" onClick={()=>setCompact(c=>!c)}>{compact ? 'Mode normal' : 'Mode compact'}</button>
        <button className="btn btn-ghost ml-8" onClick={async ()=>{
          setLoadingPdf(true)
          try{
            const resp = await fetch(`http://localhost:4000/api/invoices/${id}/pdf${compact? '?compact=1':''}`, { credentials: 'include' });
            if(!resp.ok){
              const err = await resp.json().catch(()=>({error:'Erreur'}));
              setLoadingPdf(false)
              return alert(err.error || 'Erreur lors de la génération du PDF')
            }
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            // set embedded url and open modal
            if(pdfUrl) URL.revokeObjectURL(pdfUrl)
            setPdfUrl(url)
            setShowModal(true)
          }catch(e){
            alert('Erreur lors du téléchargement du PDF')
          }finally{ setLoadingPdf(false) }
        }}>{loadingPdf ? 'Chargement...' : 'Afficher PDF (modal)'}</button>
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
        }} className="ml-8">Télécharger PDF</button>
      </div>

      {showModal && pdfUrl && (
        <div role="dialog" aria-modal="true" className="modal-backdrop" onClick={()=>{ setShowModal(false); }}>
          <div className="modal-content" onClick={(e)=>e.stopPropagation()}>
            <div className="modal-header">
              <div style={{fontWeight:600}}>Aperçu PDF - {inv.numero_facture}</div>
              <div>
                <button className="btn btn-ghost mr-8" onClick={()=>{
                  try{
                    if(iframeRef.current && iframeRef.current.contentWindow) iframeRef.current.contentWindow.print();
                    else alert('Impression non disponible');
                  }catch(e){ alert('Impossible de lancer l\'impression depuis l\'iframe: ' + e.message) }
                }} >Imprimer le PDF</button>
                <button className="btn btn-ghost" onClick={()=>{ setShowModal(false); }}>Fermer</button>
              </div>
            </div>
            <div className="iframe-full">
              <iframe ref={iframeRef} title="facture-pdf" src={pdfUrl} className="iframe-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
