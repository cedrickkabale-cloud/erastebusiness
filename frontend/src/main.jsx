import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import InvoiceForm from './pages/InvoiceForm'
import TicketView from './pages/TicketView'
import Admin from './pages/Admin'
import './styles.css'

function App(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login/>} />
        <Route path="/invoice" element={<InvoiceForm/>} />
        <Route path="/ticket/:id" element={<TicketView/>} />
        <Route path="/admin" element={<Admin/>} />
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')).render(<App />)

// set axios to send cookies by default
import axios from 'axios'
axios.defaults.withCredentials = true
