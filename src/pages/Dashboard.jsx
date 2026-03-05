import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Send, MessageSquare, TrendingUp, Clock, ChevronRight } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import { getDashboardStats } from '../api/dashboard'
import { getRecentActivity } from '../api/messages'

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function fmtPct(n) {
  return n == null ? '—' : `${n}%`
}

export default function Dashboard() {
  const [stats,    setStats]    = useState(null)
  const [activity, setActivity] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([getDashboardStats(), getRecentActivity()])
      .then(([s, a]) => { setStats(s); setActivity(a) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Dashboard" subtitle="Overview of your outreach activity" />

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Spinner size={24} />
          </div>
        ) : (
          <div className="max-w-6xl space-y-8">
            {/* Stat cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                title="Total Leads"
                value={stats?.total_leads ?? 0}
                icon={Users}
                color="indigo"
              />
              <StatCard
                title="Emails Sent"
                value={stats?.total_sent ?? 0}
                icon={Send}
                color="violet"
              />
              <StatCard
                title="Responded"
                value={stats?.total_responded ?? 0}
                icon={MessageSquare}
                color="emerald"
              />
              <StatCard
                title="Response Rate"
                value={fmtPct(stats?.response_rate_pct)}
                icon={TrendingUp}
                color="amber"
                subtitle="of total leads"
              />
            </div>

            {/* Recent activity */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-800">Recent Activity</h2>
                </div>
                <Link
                  to="/leads"
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5"
                >
                  View all leads <ChevronRight size={12} />
                </Link>
              </div>

              {activity.length === 0 ? (
                <EmptyState
                  icon={Send}
                  title="No messages sent yet"
                  description="Upload an outreach CSV or send a manual email to get started."
                />
              ) : (
                <div className="divide-y divide-slate-50">
                  {activity.map((row) => (
                    <Link
                      key={row.id}
                      to={`/leads/${row.lead_id ?? ''}`}
                      className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors"
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-indigo-700">
                          {(row.name || row.email || '?')[0].toUpperCase()}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800 truncate">
                            {row.name ?? row.email}
                          </span>
                          <span className="text-xs text-slate-400 shrink-0">
                            {row.union_name} · {row.local}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{row.subject}</p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Badge type={row.status === 'sent' ? 'success' : 'error'} dot>
                          {row.status}
                        </Badge>
                        <span className="text-xs text-slate-400">{fmtDate(row.sent_at)}</span>
                        <ChevronRight size={14} className="text-slate-300" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
