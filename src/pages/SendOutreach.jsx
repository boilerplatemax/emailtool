import { useState } from 'react'
import Papa from 'papaparse'
import { Send, Download, XCircle, AlertCircle, CheckCircle2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import CsvDropzone from '../components/CsvDropzone'
import Spinner from '../components/Spinner'
import { useToast } from '../context/ToastContext'
import { sendOutreach } from '../api/functions'

const REQUIRED_COLS = ['union', 'local', 'email', 'subject', 'body']
const OPTIONAL_COLS = ['province', 'employer / sector', 'name']
const ALL_COLS      = [...REQUIRED_COLS, ...OPTIONAL_COLS]

const SENDER_EMAIL  = import.meta.env.VITE_SENDER_EMAIL ?? ''
const SENDER_NAME   = import.meta.env.VITE_SENDER_NAME  ?? ''

function normaliseRow(r) {
  const out = {}
  for (const [k, v] of Object.entries(r)) {
    out[k.trim().toLowerCase()] = typeof v === 'string' ? v.trim() : v
  }
  return {
    union_name:      out.union              || '',
    local:           out.local              || '',
    email:           (out.email             || '').toLowerCase(),
    province:        out.province             || null,
    employer_sector: out['employer / sector'] || null,
    subject:         out.subject            || '',
    body:            out.body               || '',
    name:            out.name               || null,
  }
}

function parseCsv(file) {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header:          true,
      skipEmptyLines:  true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete:        (r) => resolve(r),
    })
  })
}

function ResultBanner({ result }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">Send Results</h3>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Sent',         value: result.sent,         color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Failed',       value: result.failed,       color: 'text-red-600',     bg: 'bg-red-50'     },
          { label: 'Leads Created',value: result.leadsCreated, color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-lg p-4 text-center`}>
            <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {result.errors?.length > 0 && (
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <div className="bg-red-50 px-4 py-2 flex items-center gap-2">
            <AlertCircle size={13} className="text-red-500" />
            <span className="text-xs font-medium text-red-700">{result.errors.length} send errors</span>
          </div>
          <div className="divide-y divide-red-100 max-h-48 overflow-y-auto">
            {result.errors.map((e, i) => (
              <div key={i} className="px-4 py-2.5 text-xs">
                <span className="text-red-600">{e.reason}</span>
                {e.row && (
                  <span className="text-slate-400 ml-2">({e.row.email})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SendOutreach() {
  const { addToast } = useToast()
  const [file,        setFile]        = useState(null)
  const [parsedRows,  setParsedRows]  = useState([])
  const [parseErrors, setParseErrors] = useState([])
  const [senderName,  setSenderName]  = useState(SENDER_NAME)
  const [senderEmail, setSenderEmail] = useState(SENDER_EMAIL)
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState(null)

  async function handleFile(f) {
    setFile(f)
    setResult(null)
    setParsedRows([])
    setParseErrors([])
    if (!f) return

    const parsed = await parseCsv(f)
    const headers = parsed.meta.fields ?? []
    const missing = REQUIRED_COLS.filter(c => !headers.includes(c))

    if (missing.length) {
      setParseErrors([`Missing required columns: ${missing.join(', ')}`])
      return
    }

    const rows = parsed.data
      .map(normaliseRow)
      .filter(r => r.union_name && r.local && r.email && r.subject && r.body)

    setParsedRows(rows)
  }

  async function handleSend() {
    if (!parsedRows.length || !senderEmail.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await sendOutreach({
        filename:    file.name,
        rows:        parsedRows,
        senderEmail: senderEmail.trim(),
        senderName:  senderName.trim(),
      })
      setResult(res)
      addToast(`Done — ${res.sent} sent, ${res.failed} failed.`, res.failed ? 'warning' : 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setFile(null)
    setParsedRows([])
    setParseErrors([])
    setResult(null)
  }

  const previewRows = parsedRows.slice(0, 6)

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Send Outreach"
        subtitle="Upload a CSV to send a batch of personalised emails"
      />

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl space-y-6">

          {/* Warning banner */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Emails are sent immediately upon confirmation. Verify your CSV before submitting.
              New leads are created automatically for any (union + local) not yet in the database.
            </p>
          </div>

          {/* Template */}
          <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3.5">
            <div>
              <p className="text-sm font-medium text-indigo-800">Download template</p>
              <p className="text-xs text-indigo-500 mt-0.5">
                Required: union, local, email, subject, body · Optional: province, employer / sector, name
              </p>
            </div>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(ALL_COLS.join(',') + '\n')}`}
              download="outreach-template.csv"
              className="flex items-center gap-1.5 text-sm font-medium text-indigo-700 hover:text-indigo-900 transition-colors"
            >
              <Download size={14} /> Download
            </a>
          </div>

          {/* Step 1 — Upload */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">1 · Select CSV</h2>
            <CsvDropzone file={file} onFile={handleFile} />
            {parseErrors.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-red-600">
                <XCircle size={14} /> {e}
              </div>
            ))}
          </div>

          {parsedRows.length > 0 && !result && (
            <>
              {/* Step 2 — Sender */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <h2 className="text-sm font-semibold text-slate-700">2 · Sender Details</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Sender Name</label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                      Sender Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  The sender email must be verified in your SendGrid account.
                </p>
              </div>

              {/* Step 3 — Preview */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">3 · Preview</h2>
                  <span className="text-xs text-slate-400">
                    {parsedRows.length} rows · showing first 6
                  </span>
                </div>
                <div className="divide-y divide-slate-50">
                  {previewRows.map((r, i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="flex items-center gap-3 mb-1.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-indigo-700">
                            {(r.name || r.email)[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-slate-800">{r.name ?? r.email}</span>
                          <span className="text-xs text-slate-400 ml-2">
                            {r.union_name} · {r.local}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-slate-600 ml-10">{r.subject}</p>
                      <p className="text-xs text-slate-400 ml-10 truncate">{r.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 4 — Send */}
              <div className="flex items-center justify-between">
                <button
                  onClick={reset}
                  className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
                >
                  ← Start over
                </button>
                <button
                  onClick={handleSend}
                  disabled={loading || !senderEmail.trim()}
                  className="flex items-center gap-2 bg-indigo-600 text-white font-medium text-sm px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? <Spinner size={15} className="text-white" /> : <Send size={15} />}
                  {loading ? 'Sending…' : `Send ${parsedRows.length} emails`}
                </button>
              </div>
            </>
          )}

          {result && (
            <>
              <ResultBanner result={result} />
              <div className="flex justify-end">
                <button
                  onClick={reset}
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <CheckCircle2 size={14} className="text-emerald-500" /> Send another batch
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
