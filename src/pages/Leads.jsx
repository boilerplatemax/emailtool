import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search, Users, ChevronRight, SlidersHorizontal,
  Phone, Mail as MailIcon, MapPin, X,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import { getLeads, getProvinces } from '../api/leads'

const PAGE_SIZE = 50

function fmtDate(ts) {
  if (!ts) return <span className="text-slate-300">Never</span>
  return new Date(ts).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Avatar({ name, email, phone }) {
  const ch = (name || email || phone || '?')[0].toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
      <span className="text-xs font-semibold text-indigo-700">{ch}</span>
    </div>
  )
}

const STATUS_FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'pending',   label: 'Pending' },
  { id: 'responded', label: 'Responded' },
  { id: 'called',    label: 'Called' },
  { id: 'uncalled',  label: 'Uncalled' },
]

function statusToFilters(id) {
  switch (id) {
    case 'responded': return { responded: true }
    case 'pending':   return { responded: false }
    case 'called':    return { called: true }
    case 'uncalled':  return { called: false }
    default:          return {}
  }
}

export default function Leads() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // ── State synced with URL search params ─────────────────────
  const search    = searchParams.get('search')    ?? ''
  const status    = searchParams.get('status')    ?? 'all'
  const province  = searchParams.get('province')  ?? ''
  const hasPhone  = searchParams.get('hasPhone')  === '1'
  const hasEmail  = searchParams.get('hasEmail')  === '1'
  const page      = parseInt(searchParams.get('page') ?? '1', 10) || 1

  // local input state for debounced search
  const [searchInput, setSearchInput] = useState(search)
  useEffect(() => { setSearchInput(search) }, [search])

  const [leads,     setLeads]     = useState([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [provinces, setProvinces] = useState([])
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const debounceRef = useRef(null)

  // Update URL helper (preserves prior params)
  const setParam = useCallback((updates) => {
    const next = new URLSearchParams(searchParams)
    for (const [k, v] of Object.entries(updates)) {
      if (v === '' || v === null || v === undefined || v === false) {
        next.delete(k)
      } else if (v === true) {
        next.set(k, '1')
      } else {
        next.set(k, String(v))
      }
    }
    // Reset to page 1 on any filter change
    if (Object.keys(updates).some(k => k !== 'page')) next.delete('page')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  // Load distinct provinces once
  useEffect(() => {
    getProvinces().then(setProvinces).catch(() => {})
  }, [])

  const filters = useMemo(() => ({
    search: search || undefined,
    province: province || undefined,
    hasPhone: hasPhone || undefined,
    hasEmail: hasEmail || undefined,
    ...statusToFilters(status),
  }), [search, status, province, hasPhone, hasEmail])

  // Fetch leads when filters change
  useEffect(() => {
    let cancel = false
    setLoading(true)
    getLeads({ ...filters, page, pageSize: PAGE_SIZE })
      .then(({ data, count }) => {
        if (cancel) return
        setLeads(data ?? [])
        setTotal(count ?? 0)
      })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [filters, page])

  // Debounce search input
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (searchInput !== search) setParam({ search: searchInput })
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [searchInput, search, setParam])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  // Build query string to preserve filters when navigating to a lead
  const filterQs = useMemo(() => {
    const qs = new URLSearchParams(searchParams)
    qs.delete('page')
    return qs.toString()
  }, [searchParams])

  function leadHref(id) {
    return filterQs ? `/leads/${id}?${filterQs}` : `/leads/${id}`
  }

  const activeAdvancedCount =
    (province ? 1 : 0) + (hasPhone ? 1 : 0) + (hasEmail ? 1 : 0)

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Leads"
        subtitle={`${total.toLocaleString()} contacts`}
        action={
          <Link
            to="/import-leads"
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-3 sm:px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Import CSV
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-3 sm:p-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[160px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, union, email, phone…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <button
                type="button"
                onClick={() => setAdvancedOpen(o => !o)}
                className={[
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
                  advancedOpen || activeAdvancedCount
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                <SlidersHorizontal size={13} />
                Filters
                {activeAdvancedCount > 0 && (
                  <span className="ml-1 bg-indigo-600 text-white rounded-full px-1.5 text-[10px] leading-4">
                    {activeAdvancedCount}
                  </span>
                )}
              </button>
            </div>

            {/* Status pills (scrollable on mobile) */}
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="inline-flex items-center gap-1 bg-slate-100 rounded-lg p-1 whitespace-nowrap">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setParam({ status: f.id === 'all' ? '' : f.id })}
                    className={[
                      'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                      status === f.id || (f.id === 'all' && !status)
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700',
                    ].join(' ')}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced filters drawer */}
            {advancedOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    <MapPin size={11} className="inline -mt-0.5 mr-1" />
                    Province
                  </label>
                  <select
                    value={province}
                    onChange={(e) => setParam({ province: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                  >
                    <option value="">Any province</option>
                    {provinces.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasPhone}
                      onChange={(e) => setParam({ hasPhone: e.target.checked })}
                      className="accent-indigo-600 w-4 h-4"
                    />
                    <span className="text-sm text-slate-700 flex items-center gap-1.5">
                      <Phone size={13} className="text-slate-400" />
                      Has phone
                    </span>
                  </label>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasEmail}
                      onChange={(e) => setParam({ hasEmail: e.target.checked })}
                      className="accent-indigo-600 w-4 h-4"
                    />
                    <span className="text-sm text-slate-700 flex items-center gap-1.5">
                      <MailIcon size={13} className="text-slate-400" />
                      Has email
                    </span>
                  </label>
                </div>

                {activeAdvancedCount > 0 && (
                  <div className="sm:col-span-3">
                    <button
                      onClick={() => setParam({ province: '', hasPhone: false, hasEmail: false })}
                      className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      <X size={12} /> Clear advanced filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Spinner />
            </div>
          ) : leads.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No leads found"
              description="Try adjusting your search or import a CSV to add leads."
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Contact', 'Union / Local', 'Phone', 'Last Contacted', 'Status', ''].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {leads.map((lead) => (
                      <tr
                        key={lead.id}
                        onClick={() => navigate(leadHref(lead.id))}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={lead.name} email={lead.email} phone={lead.phone} />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 truncate">
                                {lead.name ?? <span className="text-slate-400 italic">No name</span>}
                              </p>
                              <p className="text-xs text-slate-400 truncate">
                                {lead.email ?? <span className="italic">no email</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-medium text-slate-700">{lead.union_name}</span>
                          <span className="text-slate-400 mx-1">·</span>
                          <span className="text-slate-500">{lead.local}</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 tabular-nums whitespace-nowrap">
                          {lead.phone ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                          {fmtDate(lead.last_contacted_at)}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {lead.responded
                              ? <Badge type="success" dot>Responded</Badge>
                              : <Badge type="default" dot>Pending</Badge>}
                            {lead.called && <Badge type="info" dot>Called</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <ChevronRight size={16} className="text-slate-300" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {leads.map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => navigate(leadHref(lead.id))}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 active:bg-slate-100 flex items-start gap-3"
                  >
                    <Avatar name={lead.name} email={lead.email} phone={lead.phone} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-800 truncate">
                          {lead.name ?? <span className="text-slate-400 italic">No name</span>}
                        </p>
                        <ChevronRight size={16} className="text-slate-300 shrink-0" />
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {lead.union_name} · {lead.local}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                        {lead.phone && <span className="flex items-center gap-1"><Phone size={11}/>{lead.phone}</span>}
                        {lead.email && <span className="truncate max-w-[180px]"><MailIcon size={11} className="inline mr-1"/>{lead.email}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {lead.responded
                          ? <Badge type="success" dot>Responded</Badge>
                          : <Badge type="default" dot>Pending</Badge>}
                        {lead.called && <Badge type="info" dot>Called</Badge>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-3 sm:px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Page {page} of {totalPages} · {total} leads
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setParam({ page: Math.max(1, page - 1) })}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <button
                  onClick={() => setParam({ page: Math.min(totalPages, page + 1) })}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
