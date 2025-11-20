import React, { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import { useParams } from 'react-router-dom'
import QRCode from 'react-qr-code'

export default function TicketView(){
  const { id } = useParams()
  const [inv, setInv] = useState(null)
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
            // set embedded url and open modal
            if(pdfUrl) URL.revokeObjectURL(pdfUrl)
            setPdfUrl(url)
            setShowModal(true)
          }catch(e){
            alert('Erreur lors du téléchargement du PDF')
          }finally{ setLoadingPdf(false) }
        }} style={{marginLeft:8}}>{loadingPdf ? 'Chargement...' : 'Afficher PDF (modal)'}</button>
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

      {showModal && pdfUrl && (
        <div role="dialog" aria-modal="true" style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999}} onClick={()=>{ setShowModal(false); }}>
          <div style={{width:'80%', height:'80%', background:'#fff', borderRadius:8, padding:12, boxShadow:'0 6px 24px rgba(0,0,0,0.2)', display:'flex', flexDirection:'column'}} onClick={(e)=>e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
              <div style={{fontWeight:600}}>Aperçu PDF - {inv.numero_facture}</div>
              <div>
                <button onClick={()=>{
                  try{
                    if(iframeRef.current && iframeRef.current.contentWindow) iframeRef.current.contentWindow.print();
                    else alert('Impression non disponible');
                  }catch(e){ alert('Impossible de lancer l\'impression depuis l\'iframe: ' + e.message) }
                }} style={{marginRight:8}}>Imprimer le PDF</button>
                <button onClick={()=>{ setShowModal(false); }}>Fermer</button>
              </div>
            </div>
            <div style={{flex:1}}>
              <iframe ref={iframeRef} title="facture-pdf" src={pdfUrl} style={{width:'100%', height:'100%', border:'1px solid #ddd'}} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
