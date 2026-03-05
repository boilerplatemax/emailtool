const ACCENTS = {
  indigo:  { bar: 'bg-indigo-500',  icon: 'bg-indigo-50 text-indigo-600'  },
  emerald: { bar: 'bg-emerald-500', icon: 'bg-emerald-50 text-emerald-600' },
  violet:  { bar: 'bg-violet-500',  icon: 'bg-violet-50 text-violet-600'   },
  amber:   { bar: 'bg-amber-500',   icon: 'bg-amber-50 text-amber-600'     },
}

export default function StatCard({ title, value, icon: Icon, color = 'indigo', subtitle }) {
  const ac = ACCENTS[color] ?? ACCENTS.indigo
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* top accent bar */}
      <div className={`h-1 ${ac.bar}`} />
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <div className={`p-2 rounded-lg ${ac.icon}`}>
            <Icon size={16} />
          </div>
        </div>
        <p className="text-3xl font-bold text-slate-900 tabular-nums">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}
