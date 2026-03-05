const STYLES = {
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  error:   'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  info:    'bg-blue-100 text-blue-700 border-blue-200',
  indigo:  'bg-indigo-100 text-indigo-700 border-indigo-200',
  default: 'bg-slate-100 text-slate-600 border-slate-200',
}

export default function Badge({ type = 'default', children, dot = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${STYLES[type] ?? STYLES.default}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  )
}
