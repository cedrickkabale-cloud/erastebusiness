import React, { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import { useEffect } from 'react'

export default function Login(){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(()=>{
    // try to get current user from cookie/session and prefill Gérant
    axios.get('http://localhost:4000/api/me', { withCredentials: true }).then(res=>{
      const u = res?.data?.user
      if(u){
        setUsername(u.full_name || u.username || '')
      }
    }).catch(()=>{
      // ignore if not authenticated
    })

    // also fetch seller of the day to prefill/display
    axios.get('http://localhost:4000/api/seller-of-day').then(res=>{
      const s = res?.data
      if(s && s.username){
        // only prefill if username is empty
        setUsername(prev => prev ? prev : (s.full_name || s.username))
      }
    }).catch(()=>{
      // ignore if none
    })
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    try{
      const res = await axios.post('http://localhost:4000/api/login', { username, password }, { withCredentials: true })
      // server sets httpOnly cookie; store minimal user info
      localStorage.setItem('user', JSON.stringify(res.data.user))
      navigate('/invoice')
    }catch(err){
      setError(err?.response?.data?.error || 'Erreur de connexion')
    }
  }

  return (
    <div className="login-page">
      <header className="login-header">
        <img src="/logo-ministere.svg" alt="Ministère" className="logo left" />
        <div className="header-text">Ministère de l'Entreprenariat et Développement des Petites et Moyennes Entreprises de la RDC</div>
        <img src="/logo-eraste.svg" alt="Eraste Business" className="logo right" />
      </header>
      <main className="login-main">
        <div className="login-card">
          <h2>🔐 Connexion Sécurisée</h2>
          <div className="mb-8">
            <strong style={{color: 'var(--primary-900)'}}>Vendeur du jour: </strong>
            <span className="ml-6" style={{color: 'var(--accent)', fontWeight: '700'}}>{username || '—'}</span>
          </div>
          <form className="login-box" onSubmit={submit}>
              <label htmlFor="username">👤 Nom d'utilisateur</label>
              <input id="username" name="username" placeholder="Entrez votre nom" value={username} onChange={e=>setUsername(e.target.value)} />
            <label htmlFor="password">🔑 Mot de passe</label>
            <input id="password" name="password" placeholder="Entrez votre mot de passe" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
            <button className="btn btn-gold" type="submit">✨ Se connecter</button>
            {error && <div className="error">⚠️ {error}</div>}
          </form>
        </div>
      </main>
      <footer className="login-footer">
        <div>© Eraste Business SARL - 2025 | Tous droits réservés</div>
        <Link to="/admin" className="admin-link" style={{display: 'inline-block', marginTop: '12px'}}>🔧 Administration</Link>
      </footer>
    </div>
  )
}
