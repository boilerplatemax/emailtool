import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import { isAuthenticated } from './utils/auth'
import Layout from './components/Layout'
import PasswordGate from './pages/PasswordGate'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import LeadDetail from './pages/LeadDetail'
import ImportLeads from './pages/ImportLeads'
import SendOutreach from './pages/SendOutreach'
import ManualEmail from './pages/ManualEmail'

export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated())

  if (!authed) {
    return <PasswordGate onSuccess={() => setAuthed(true)} />
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"     element={<Dashboard />} />
            <Route path="/leads"         element={<Leads />} />
            <Route path="/leads/:id"     element={<LeadDetail />} />
            <Route path="/import-leads"  element={<ImportLeads />} />
            <Route path="/send-outreach" element={<SendOutreach />} />
            <Route path="/manual-email"  element={<ManualEmail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
