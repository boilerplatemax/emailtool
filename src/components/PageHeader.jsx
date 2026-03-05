export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
