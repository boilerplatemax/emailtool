import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Mail, Phone, MapPin, Building2, Globe,
  CheckCircle2, Circle, Save, Send, Clock, AlertCircle,
  ChevronLeft, ChevronRight, PhoneCall, ExternalLink,
} from 'lucide-react'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import { useToast } from '../context/ToastContext'
import { getLeadById, getLeadIds, setResponded, setCalled, updateNotes } from '../api/leads'
import { sendSingleEmail } from '../api/functions'

const SENDER_EMAIL = import.meta.env.VITE_SENDER_EMAIL ?? ''
const SENDER_NAME  = import.meta.env.VITE_SENDER_NAME  ?? ''

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function normaliseUrl(url) {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function InfoRow({ icon: Icon, label, value, action }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <Icon size={14} className="text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400">{label}</p>
        <div className="text-sm text-slate-800 font-medium break-words">{value}</div>
      </div>
      {action}
    </div>
  )
}

function MessageBubble({ msg }) {
  const ok = msg.status === 'sent'
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
        <div className="w-px flex-1 bg-slate-100 mt-1" />
      </div>
      <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 mb-3 shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-800">{msg.subject}</p>
          <div className="flex items-center gap-2 shrink-0">
            <Badge type={ok ? 'success' : 'error'} dot>{msg.status}</Badge>
            <span className="text-xs text-slate-400">{fmtDate(msg.sent_at ?? msg.created_at)}</span>
          </div>
        </div>
        <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{msg.body}</p>
        {msg.error_message && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle size={12} /> {msg.error_message}
          </div>
        )}
        {msg.sender_name && (
          <p className="text-xs text-slate-400 mt-2">
            Sent by {msg.sender_name} &lt;{msg.sender_email}&gt;
          </p>
        )}
      </div>
    </div>
  )
}

export default function LeadDetail() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const [searchParams] = useSearchParams()
  const { addToast } = useToast()

  const [lead,      setLead]      = useState(null)
  const [messages,  setMessages]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [notes,     setNotes]     = useState('')
  const [notesDirty, setNotesDirty] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [togglingResp, setTogglingResp] = useState(false)
  const [togglingCalled, setTogglingCalled] = useState(false)
  const [autoCalledOnDial, setAutoCalledOnDial] = useState(true)

  // Adjacent leads for prev/next navigation
  const [neighbors, setNeighbors] = useState({ prev: null, next: null })

  // Send form
  const [subject,    setSubject]    = useState('')
  const [body,       setBody]       = useState('')
  const [senderName,  setSenderName]  = useState(SENDER_NAME)
  const [senderEmail, setSenderEmail] = useState(SENDER_EMAIL)
  const [sending,    setSending]    = useState(false)

  // Derived filter object from URL params
  const filters = useMemo(() => {
    const status = searchParams.get('status')
    const f = {
      search:   searchParams.get('search')   || undefined,
      province: searchParams.get('province') || undefined,
      hasPhone: searchParams.get('hasPhone') === '1' ? true : undefined,
      hasEmail: searchParams.get('hasEmail') === '1' ? true : undefined,
    }
    if (status === 'responded') f.responded = true
    if (status === 'pending')   f.responded = false
    if (status === 'called')    f.called    = true
    if (status === 'uncalled')  f.called    = false
    return f
  }, [searchParams])

  const filterQs = useMemo(() => {
    const qs = new URLSearchParams(searchParams)
    qs.delete('page')
    return qs.toString()
  }, [searchParams])

  function neighborHref(neighborId) {
    return filterQs ? `/leads/${neighborId}?${filterQs}` : `/leads/${neighborId}`
  }

  useEffect(() => {
    setLoading(true)
    getLeadById(id)
      .then((data) => {
        setLead(data)
        setNotes(data.notes ?? '')
        const sorted = [...(data.messages ?? [])].sort(
          (a, b) => new Date(b.sent_at ?? b.created_at) - new Date(a.sent_at ?? a.created_at),
        )
        setMessages(sorted)
      })
      .catch(() => addToast('Failed to load lead.', 'error'))
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line

  // Resolve prev/next leads given the current filters
  useEffect(() => {
    let cancel = false
    getLeadIds(filters)
      .then((ids) => {
        if (cancel) return
        const idx = ids.indexOf(id)
        if (idx === -1) {
          setNeighbors({ prev: null, next: null })
          return
        }
        setNeighbors({
          prev: idx > 0              ? ids[idx - 1] : null,
          next: idx < ids.length - 1 ? ids[idx + 1] : null,
        })
      })
      .catch(() => setNeighbors({ prev: null, next: null }))
    return () => { cancel = true }
  }, [id, filters])

  // Keyboard shortcuts for prev/next
  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
      if (e.key === 'ArrowLeft'  && neighbors.prev) navigate(neighborHref(neighbors.prev))
      if (e.key === 'ArrowRight' && neighbors.next) navigate(neighborHref(neighbors.next))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [neighbors, navigate, filterQs]) // eslint-disable-line

  async function handleToggleResponded() {
    setTogglingResp(true)
    try {
      const updated = await setResponded(id, !lead.responded)
      setLead(prev => ({ ...prev, responded: updated.responded }))
      addToast(`Marked as ${updated.responded ? 'responded' : 'pending'}.`)
    } catch {
      addToast('Failed to update status.', 'error')
    } finally {
      setTogglingResp(false)
    }
  }

  async function handleToggleCalled(forceTrue = false) {
    setTogglingCalled(true)
    try {
      const target = forceTrue ? true : !lead.called
      if (forceTrue && lead.called) return // already called
      const updated = await setCalled(id, target)
      setLead(prev => ({ ...prev, called: updated.called }))
      if (!forceTrue) addToast(`Marked as ${updated.called ? 'called' : 'not called'}.`)
    } catch {
      addToast('Failed to update call status.', 'error')
    } finally {
      setTogglingCalled(false)
    }
  }

  function handleCall() {
    if (!lead?.phone) return
    if (autoCalledOnDial && !lead.called) handleToggleCalled(true)
    // tel: link is handled by the anchor element
  }

  async function handleSaveNotes() {
    setSavingNotes(true)
    try {
      await updateNotes(id, notes)
      setNotesDirty(false)
      addToast('Notes saved.')
    } catch {
      addToast('Failed to save notes.', 'error')
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!subject.trim() || !body.trim() || !senderEmail.trim()) return
    setSending(true)
    try {
      const result = await sendSingleEmail({ leadId: id, subject, body, senderEmail, senderName })
      if (result.success) {
        addToast('Email sent successfully.')
        setSubject('')
        setBody('')
        const fresh = await getLeadById(id)
        const sorted = [...(fresh.messages ?? [])].sort(
          (a, b) => new Date(b.sent_at ?? b.created_at) - new Date(a.sent_at ?? a.created_at),
        )
        setMessages(sorted)
        setLead(fresh)
      } else {
        addToast(`Send failed: ${result.error}`, 'error')
      }
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Spinner size={24} />
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="p-8">
        <p className="text-slate-500">Lead not found.</p>
      </div>
    )
  }

  const phoneTel = lead.phone ? `tel:${lead.phone.replace(/[^0-9+]/g, '')}` : null
  const websiteUrl = normaliseUrl(lead.website)
  const backHref = filterQs ? `/leads?${filterQs}` : '/leads'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <button
            onClick={() => navigate(backHref)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>

          {/* Prev/Next navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => neighbors.prev && navigate(neighborHref(neighbors.prev))}
              disabled={!neighbors.prev}
              title="Previous lead (←)"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
              <span className="hidden sm:inline">Prev</span>
            </button>
            <button
              onClick={() => neighbors.next && navigate(neighborHref(neighbors.next))}
              disabled={!neighbors.next}
              title="Next lead (→)"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
              <span className="text-base sm:text-lg font-bold text-indigo-700">
                {(lead.name || lead.email || lead.phone || '?')[0].toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-slate-900 truncate">
                {lead.name ?? <span className="italic text-slate-400">No name</span>}
              </h1>
              <p className="text-sm text-slate-500 truncate">
                {lead.email ?? lead.phone ?? <span className="italic">no contact</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Call button */}
            {phoneTel ? (
              <a
                href={phoneTel}
                onClick={handleCall}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                <PhoneCall size={15} />
                <span>Call</span>
              </a>
            ) : (
              <button
                disabled
                title="No phone number on file"
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-400 cursor-not-allowed"
              >
                <PhoneCall size={15} />
                <span>Call</span>
              </button>
            )}

            <button
              onClick={() => handleToggleCalled(false)}
              disabled={togglingCalled}
              className={[
                'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
                lead.called
                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
              ].join(' ')}
            >
              {lead.called ? <CheckCircle2 size={15} /> : <Circle size={15} />}
              {lead.called ? 'Called' : 'Mark called'}
            </button>

            <button
              onClick={handleToggleResponded}
              disabled={togglingResp}
              className={[
                'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
                lead.responded
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
              ].join(' ')}
            >
              {lead.responded ? <CheckCircle2 size={15} /> : <Circle size={15} />}
              {lead.responded ? 'Responded' : 'Mark responded'}
            </button>
          </div>
        </div>

        {phoneTel && (
          <label className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoCalledOnDial}
              onChange={(e) => setAutoCalledOnDial(e.target.checked)}
              className="accent-indigo-600 w-3.5 h-3.5"
            />
            Auto-mark as called when I tap Call
          </label>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">

          {/* Left column */}
          <div className="space-y-5">
            {/* Info card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-700">Contact Info</h2>
              <InfoRow icon={Building2} label="Union / Local" value={`${lead.union_name} · ${lead.local}`} />
              <InfoRow icon={Mail}      label="Email"         value={lead.email} />
              <InfoRow
                icon={Phone}
                label="Phone"
                value={
                  lead.phone
                    ? (
                      <a href={phoneTel} onClick={handleCall} className="text-indigo-600 hover:text-indigo-800 underline-offset-2 hover:underline">
                        {lead.phone}
                      </a>
                    )
                    : null
                }
              />
              <InfoRow
                icon={Globe}
                label="Website"
                value={
                  websiteUrl
                    ? (
                      <a
                        href={websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 underline-offset-2 hover:underline inline-flex items-center gap-1 break-all"
                      >
                        {lead.website}
                        <ExternalLink size={11} className="shrink-0" />
                      </a>
                    )
                    : null
                }
              />
              <InfoRow icon={MapPin} label="Address" value={[lead.address, lead.province].filter(Boolean).join(', ')} />
              <div className="pt-2 border-t border-slate-100 flex gap-4 text-xs text-slate-400 flex-wrap">
                <span><b className="text-slate-700 text-sm tabular-nums">{lead.total_contacts}</b> emails sent</span>
                {lead.last_contacted_at && (
                  <span>Last: {new Date(lead.last_contacted_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>

            {/* Notes card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">Notes</h2>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setNotesDirty(true) }}
                placeholder="Add notes about this lead…"
                rows={5}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
              {notesDirty && (
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <Save size={12} />
                  {savingNotes ? 'Saving…' : 'Save notes'}
                </button>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Send email form */}
            {lead.email && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-4">Send Email</h2>
                <form onSubmit={handleSend} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Your Name</label>
                      <input
                        type="text"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="Jane Smith"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Your Email <span className="text-red-400">*</span></label>
                      <input
                        type="email"
                        value={senderEmail}
                        onChange={(e) => setSenderEmail(e.target.value)}
                        placeholder="jane@example.com"
                        required
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Subject <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Email subject line"
                      required
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Body <span className="text-red-400">*</span></label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Write your message…"
                      rows={5}
                      required
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={sending || !subject.trim() || !body.trim() || !senderEmail.trim()}
                      className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {sending ? <Spinner size={14} className="text-white" /> : <Send size={14} />}
                      {sending ? 'Sending…' : 'Send Email'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Message history */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-5">
                <Clock size={14} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-700">
                  Message History
                  <span className="ml-1.5 text-xs font-normal text-slate-400">({messages.length})</span>
                </h2>
              </div>

              {messages.length === 0 ? (
                <EmptyState
                  icon={Mail}
                  title="No messages yet"
                  description={lead.email ? "Send the first email using the form above." : "This lead has no email; use the call button to reach them."}
                />
              ) : (
                <div>
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
