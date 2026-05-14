import { useState } from 'react'
import Papa from 'papaparse'
import { Upload, CheckCircle2, XCircle, AlertCircle, Download } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import CsvDropzone from '../components/CsvDropzone'
import Spinner from '../components/Spinner'
import { useToast } from '../context/ToastContext'
import { importLeads } from '../api/functions'

const REQUIRED_COLS = ['union', 'local']
const OPTIONAL_COLS = ['email', 'phone', 'address', 'province', 'name', 'website']
const ALL_COLS      = [...REQUIRED_COLS, ...OPTIONAL_COLS]

function normaliseRow(r) {
  // Lowercase all keys, trim values
  const out = {}
  for (const [k, v] of Object.entries(r)) {
    out[k.trim().toLowerCase()] = typeof v === 'string' ? v.trim() : v
  }
  return {
    union_name: out.union      || '',
    local:      out.local      || '',
    email:      (out.email     || '').toLowerCase() || null,
    phone:      out.phone      || null,
    address:    out.address    || null,
    province:   out.province   || null,
    name:       out.name       || null,
    website:    out.website    || null,
  }
}

function parseCsv(file) {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header:          true,
      skipEmptyLines:  true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (results) => resolve(results),
    })
  })
}

function ResultBanner({ result }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">Import Results</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Created',  value: result.created,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Updated',  value: result.updated,  color: 'text-blue-600',    bg: 'bg-blue-50'    },
          { label: 'Skipped',  value: result.skipped,  color: 'text-amber-600',   bg: 'bg-amber-50'   },
          { label: 'Failed',   value: result.failed,   color: 'text-red-600',     bg: 'bg-red-50'     },
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
            <span className="text-xs font-medium text-red-700">{result.errors.length} row errors</span>
          </div>
          <div className="divide-y divide-red-100 max-h-40 overflow-y-auto">
            {result.errors.map((e, i) => (
              <div key={i} className="px-4 py-2 text-xs text-red-600">{e.reason}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ImportLeads() {
  const { addToast } = useToast()
  const [file,              setFile]              = useState(null)
  const [parsedRows,        setParsedRows]        = useState([])
  const [parseErrors,       setParseErrors]       = useState([])
  const [duplicateBehavior, setDuplicateBehavior] = useState('ignore')
  const [loading,           setLoading]           = useState(false)
  const [result,            setResult]            = useState(null)

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

    const rows = parsed.data.map(normaliseRow).filter(r => r.union_name && r.local && (r.email || r.phone))
    setParsedRows(rows)
  }

  async function handleSubmit() {
    if (!parsedRows.length) return
    setLoading(true)
    setResult(null)
    try {
      const res = await importLeads({
        filename:          file.name,
        rows:              parsedRows,
        duplicateBehavior,
      })
      setResult(res)
      addToast(`Import complete — ${res.created} created, ${res.updated} updated.`)
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

  const previewRows = parsedRows.slice(0, 8)

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Import Leads"
        subtitle="Upload a CSV file to add or update leads"
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-3xl space-y-6">

          {/* Template download */}
          <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3.5">
            <div>
              <p className="text-sm font-medium text-indigo-800">Need a template?</p>
              <p className="text-xs text-indigo-500 mt-0.5">
                Required: union, local (and at least one of email/phone) · Optional: email, phone, address, province, name, website
              </p>
            </div>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(ALL_COLS.join(',') + '\n')}`}
              download="leads-template.csv"
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
              {/* Step 2 — Options */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <h2 className="text-sm font-semibold text-slate-700">2 · Duplicate Handling</h2>
                <p className="text-xs text-slate-400">
                  What to do when a (union + local) already exists in the database.
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    {
                      id:    'ignore',
                      label: 'Ignore duplicates',
                      desc:  'Skip rows that already exist. Existing data is untouched.',
                    },
                    {
                      id:    'replace',
                      label: 'Replace duplicates',
                      desc:  'Overwrite email, phone, address, province and name for existing leads.',
                    },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={[
                        'flex items-start gap-3 border rounded-xl p-4 cursor-pointer transition-colors',
                        duplicateBehavior === opt.id
                          ? 'border-indigo-300 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="dup"
                        value={opt.id}
                        checked={duplicateBehavior === opt.id}
                        onChange={() => setDuplicateBehavior(opt.id)}
                        className="mt-0.5 accent-indigo-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{opt.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Step 3 — Preview */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">3 · Preview</h2>
                  <span className="text-xs text-slate-400">
                    {parsedRows.length} rows parsed
                    {parsedRows.length > 8 ? ` · showing first 8` : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Union', 'Local', 'Email', 'Phone', 'Website', 'Province'].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {previewRows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-800">{r.union_name}</td>
                          <td className="px-4 py-2.5 text-slate-600">{r.local}</td>
                          <td className="px-4 py-2.5 text-slate-600">{r.email ?? '—'}</td>
                          <td className="px-4 py-2.5 text-slate-600">{r.phone ?? '—'}</td>
                          <td className="px-4 py-2.5 text-slate-400 max-w-[180px] truncate">{r.website ?? '—'}</td>
                          <td className="px-4 py-2.5 text-slate-400">{r.province ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Step 4 — Submit */}
              <div className="flex items-center justify-between">
                <button
                  onClick={reset}
                  className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
                >
                  ← Start over
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center gap-2 bg-indigo-600 text-white font-medium text-sm px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? <Spinner size={15} className="text-white" /> : <Upload size={15} />}
                  {loading ? 'Importing…' : `Import ${parsedRows.length} leads`}
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
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50"
                >
                  <CheckCircle2 size={14} className="text-emerald-500" /> Import another file
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
