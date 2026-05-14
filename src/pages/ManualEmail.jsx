import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, Mail, Send, CheckCircle2, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import { useToast } from '../context/ToastContext'
import { getLeads } from '../api/leads'
import { sendSingleEmail } from '../api/functions'
import SenderSelect from '../components/SenderSelect'
import { DEFAULT_SENDER } from '../lib/senders'

export default function ManualEmail() {
  const { addToast } = useToast()

  // Lead picker state
  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState([])
  const [searching,  setSearching]  = useState(false)
  const [showDrop,   setShowDrop]   = useState(false)
  const [lead,       setLead]       = useState(null)
  const debounceRef = useRef(null)
  const dropRef     = useRef(null)

  // Form state
  const [sender,      setSender]      = useState(DEFAULT_SENDER)
  const [subject,     setSubject]     = useState('')
  const [body,        setBody]        = useState('')
  const [sending,     setSending]     = useState(false)
  const [sent,        setSent]        = useState(false)

  // Search leads
  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const { data } = await getLeads({ search: q, pageSize: 8 })
      setResults(data)
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 280)
    return () => clearTimeout(debounceRef.current)
  }, [query, search])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function selectLead(l) {
    setLead(l)
    setQuery('')
    setResults([])
    setShowDrop(false)
    setSent(false)
  }

  function clearLead() {
    setLead(null)
    setSent(false)
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!lead || !subject.trim() || !body.trim() || !sender.email) return
    setSending(true)
    try {
      const result = await sendSingleEmail({
        leadId:      lead.id,
        subject:     subject.trim(),
        body:        body.trim(),
        senderEmail: sender.email,
        senderName:  sender.name,
      })
      if (result.success) {
        setSent(true)
        setSubject('')
        setBody('')
        addToast('Email sent successfully.')
      } else {
        addToast(`Send failed: ${result.error}`, 'error')
      }
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Manual Email"
        subtitle="Send a one-off email to any lead"
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-2xl space-y-6">

          {/* Lead picker */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">1 · Select a Lead</h2>

            {lead ? (
              <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-indigo-200 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-indigo-800">
                    {(lead.name || lead.email)[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-indigo-900 truncate">
                    {lead.name ?? lead.email}
                  </p>
                  <p className="text-xs text-indigo-500 truncate">
                    {lead.email} · {lead.union_name} {lead.local}
                  </p>
                </div>
                <button
                  onClick={clearLead}
                  className="text-indigo-400 hover:text-indigo-700 transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div ref={dropRef} className="relative">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setShowDrop(true) }}
                    onFocus={() => setShowDrop(true)}
                    placeholder="Search by name, email, union, or local…"
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  {searching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Spinner size={14} />
                    </div>
                  )}
                </div>

                {showDrop && (results.length > 0 || query) && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    {results.length === 0 && !searching ? (
                      <div className="px-4 py-3 text-sm text-slate-400">No leads found.</div>
                    ) : (
                      <div className="divide-y divide-slate-50 max-h-60 overflow-y-auto">
                        {results.map((r) => (
                          <button
                            key={r.id}
                            onMouseDown={() => selectLead(r)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left"
                          >
                            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                              <span className="text-xs font-semibold text-indigo-700">
                                {(r.name || r.email)[0].toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">
                                {r.name ?? <span className="text-slate-400 italic">No name</span>}
                              </p>
                              <p className="text-xs text-slate-400 truncate">
                                {r.email} · {r.union_name} {r.local}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Email form — only shown once a lead is selected */}
          {lead && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">2 · Compose Email</h2>

              {sent && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <p className="text-sm text-emerald-800 font-medium">Email sent! You can send another below.</p>
                </div>
              )}

              <form onSubmit={handleSend} className="space-y-4">
                {/* Sender */}
                <SenderSelect value={sender} onChange={setSender} required label="From" />

                {/* To (readonly) */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">To</label>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <Mail size={13} className="text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-600">{lead.email}</span>
                    {lead.name && <span className="text-xs text-slate-400">({lead.name})</span>}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Subject <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject line"
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Body <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write your message…"
                    rows={8}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={sending || !subject.trim() || !body.trim() || !sender.email}
                    className="flex items-center gap-2 bg-indigo-600 text-white font-medium text-sm px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    {sending ? <Spinner size={15} className="text-white" /> : <Send size={15} />}
                    {sending ? 'Sending…' : 'Send Email'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
