import { ChevronDown, AlertCircle } from 'lucide-react'
import { SENDERS } from '../lib/senders'

/**
 * Sender picker — single-select dropdown of the configured senders.
 *
 * `value` is a { name, email } object; `onChange` receives the new pair.
 * Falls back to a plain email input when no senders are configured,
 * so the tool keeps working in dev setups that haven't set VITE_SENDERS.
 */
export default function SenderSelect({ value, onChange, required = false, label = 'Send as' }) {
  if (SENDERS.length === 0) {
    return (
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertCircle size={13} className="shrink-0" />
          No senders configured. Set <code className="font-mono">VITE_SENDERS</code> in your env.
        </div>
      </div>
    )
  }

  const idx = Math.max(0, SENDERS.findIndex((s) => s.email === value?.email))

  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="relative">
        <select
          value={idx}
          onChange={(e) => onChange(SENDERS[Number(e.target.value)])}
          className="w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          {SENDERS.map((s, i) => (
            <option key={s.email} value={i}>
              {s.name ? `${s.name} <${s.email}>` : s.email}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  )
}
