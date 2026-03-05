import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Users, ChevronRight, CheckCircle, Circle, SlidersHorizontal } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import { getLeads } from '../api/leads'

const PAGE_SIZE = 50

function fmtDate(ts) {
  if (!ts) return <span className="text-slate-300">Never</span>
  return new Date(ts).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Avatar({ name, email }) {
  const ch = (name || email || '?')[0].toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
      <span className="text-xs font-semibold text-indigo-700">{ch}</span>
    </div>
  )
}

export default function Leads() {
  const navigate = useNavigate()
  const [leads,   setLeads]   = useState([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState('all')  // all | responded | pending
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef(null)

  const load = useCallback(async (q, f, pg) => {
    setLoading(true)
    try {
      const responded =
        f === 'responded' ? true :
        f === 'pending'   ? false : undefined
      const { data, count } = await getLeads({ search: q, responded, page: pg, pageSize: PAGE_SIZE })
      setLeads(data)
      setTotal(count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      load(search, filter, 1)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [search, filter, load])

  function handlePageChange(newPage) {
    setPage(newPage)
    load(search, filter, newPage)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const FILTERS = [
    { id: 'all',       label: 'All' },
    { id: 'responded', label: 'Responded' },
    { id: 'pending',   label: 'Pending' },
  ]

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Leads"
        subtitle={`${total.toLocaleString()} total contacts`}
        action={
          <Link
            to="/import-leads"
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Import CSV
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, email or union…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-1">
              <SlidersHorizontal size={13} className="text-slate-400 ml-1" />
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={[
                    'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                    filter === f.id
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700',
                  ].join(' ')}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Contact', 'Union / Local', 'Contacts', 'Last Contacted', 'Status', ''].map(
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
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      {/* Contact */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={lead.name} email={lead.email} />
                          <div>
                            <p className="font-medium text-slate-800">
                              {lead.name ?? <span className="text-slate-400 italic">No name</span>}
                            </p>
                            <p className="text-xs text-slate-400">{lead.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Union / Local */}
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-slate-700">{lead.union_name}</span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span className="text-slate-500">{lead.local}</span>
                      </td>

                      {/* Total contacts */}
                      <td className="px-5 py-3.5 text-slate-600 tabular-nums">
                        {lead.total_contacts}
                      </td>

                      {/* Last contacted */}
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                        {fmtDate(lead.last_contacted_at)}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        {lead.responded ? (
                          <Badge type="success" dot>Responded</Badge>
                        ) : (
                          <Badge type="default" dot>Pending</Badge>
                        )}
                      </td>

                      {/* Arrow */}
                      <td className="px-4 py-3.5">
                        <ChevronRight size={16} className="text-slate-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Page {page} of {totalPages} · {total} leads
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
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
