import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Upload,
  Send,
  Mail,
  Zap,
} from 'lucide-react'

const NAV = [
  { label: 'Dashboard',     to: '/dashboard',     icon: LayoutDashboard },
  { label: 'Leads',         to: '/leads',          icon: Users },
  null, // divider
  { label: 'Import Leads',  to: '/import-leads',   icon: Upload },
  { label: 'Send Outreach', to: '/send-outreach',  icon: Send },
  { label: 'Manual Email',  to: '/manual-email',   icon: Mail },
]

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 flex flex-col bg-slate-950 min-h-screen">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap size={14} className="text-white" fill="white" />
          </div>
          <span className="text-white font-semibold text-[15px] tracking-tight">EmailTool</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
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
  )
}
