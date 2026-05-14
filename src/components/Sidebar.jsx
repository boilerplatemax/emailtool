import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Upload,
  Send,
  Mail,
  Zap,
  X,
} from 'lucide-react'

const NAV = [
  { label: 'Dashboard',     to: '/dashboard',     icon: LayoutDashboard },
  { label: 'Leads',         to: '/leads',          icon: Users },
  null, // divider
  { label: 'Import Leads',  to: '/import-leads',   icon: Upload },
  { label: 'Send Outreach', to: '/send-outreach',  icon: Send },
  { label: 'Manual Email',  to: '/manual-email',   icon: Mail },
]

export default function Sidebar({ open = false, onClose = () => {} }) {
  const location = useLocation()

  useEffect(() => { onClose() }, [location.pathname]) // eslint-disable-line

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={[
          'fixed inset-0 bg-slate-950/60 z-30 md:hidden transition-opacity',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={[
          'fixed md:static z-40 inset-y-0 left-0',
          'w-60 shrink-0 flex flex-col bg-slate-950 min-h-screen',
          'transition-transform md:transition-none',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Zap size={14} className="text-white" fill="white" />
            </div>
            <span className="text-white font-semibold text-[15px] tracking-tight">OutreachTool</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden text-slate-400 hover:text-white"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map((item, i) => {
            if (item === null) {
              return <div key={i} className="my-2 border-t border-slate-800" />
            }
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800',
                  ].join(' ')
                }
              >
                <Icon size={16} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-slate-800">
          <p className="text-xs text-slate-600">Internal outreach tool</p>
        </div>
      </aside>
    </>
  )
}
