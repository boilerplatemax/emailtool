export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 sm:py-5 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-semibold text-slate-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
