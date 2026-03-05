import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Mail, Phone, MapPin, Building2,
  CheckCircle2, Circle, Save, Send, Clock, AlertCircle,
} from 'lucide-react'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import { useToast } from '../context/ToastContext'
import { getLeadById, setResponded, updateNotes } from '../api/leads'
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

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <Icon size={14} className="text-slate-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm text-slate-800 font-medium">{value}</p>
      </div>
    </div>
  )
}

function MessageBubble({ msg }) {
  const ok = msg.status === 'sent'
  return (
    <div className="flex gap-3">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
        <div className="w-px flex-1 bg-slate-100 mt-1" />
      </div>

      {/* Card */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 mb-3 shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-2">
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
  const { addToast } = useToast()

  const [lead,      setLead]      = useState(null)
  const [messages,  setMessages]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [notes,     setNotes]     = useState('')
  const [notesDirty, setNotesDirty] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [togglingResp, setTogglingResp] = useState(false)

  // Send form
  const [subject,    setSubject]    = useState('')
  const [body,       setBody]       = useState('')
  const [senderName,  setSenderName]  = useState(SENDER_NAME)
  const [senderEmail, setSenderEmail] = useState(SENDER_EMAIL)
  const [sending,    setSending]    = useState(false)

  useEffect(() => {
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

  async function handleToggleResponded() {
    setTogglingResp(true)
    try {
      const updated = await setResponded(id, !lead.responded)
      setLead(updated)
      addToast(`Marked as ${updated.responded ? 'responded' : 'pending'}.`)
    } catch {
      addToast('Failed to update status.', 'error')
    } finally {
      setTogglingResp(false)
    }
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
        // Reload messages
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
      <div className="flex items-center justify-center h-full">
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-4">
        <button
          onClick={() => navigate('/leads')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-3"
        >
          <ArrowLeft size={14} /> Back to leads
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-indigo-700">
                {(lead.name || lead.email)[0].toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {lead.name ?? <span className="italic text-slate-400">No name</span>}
              </h1>
              <p className="text-sm text-slate-500">{lead.email}</p>
            </div>
          </div>

          <button
            onClick={handleToggleResponded}
            disabled={togglingResp}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
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

      {/* Body — two columns */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column */}
          <div className="space-y-5">
            {/* Info card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-700">Contact Info</h2>
              <InfoRow icon={Building2} label="Union / Local"   value={`${lead.union_name} · ${lead.local}`} />
              <InfoRow icon={Mail}      label="Email"           value={lead.email} />
              <InfoRow icon={Phone}     label="Phone"           value={lead.phone} />
              <InfoRow icon={MapPin}    label="Address"         value={[lead.address, lead.province].filter(Boolean).join(', ')} />
              <div className="pt-2 border-t border-slate-100 flex gap-4 text-xs text-slate-400">
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
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Send Email</h2>
              <form onSubmit={handleSend} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
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
                  description="Send the first email using the form above."
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
