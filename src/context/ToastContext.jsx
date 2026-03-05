import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />,
  error:   <XCircle    size={16} className="text-red-500 shrink-0 mt-0.5" />,
  warning: <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />,
}

function ToastItem({ toast, onDismiss }) {
  return (
    <div className="flex items-start gap-3 bg-white border border-slate-200 shadow-lg rounded-xl px-4 py-3 min-w-[280px] max-w-sm animate-slide-in">
      {ICONS[toast.type] ?? ICONS.success}
      <p className="text-sm text-slate-700 flex-1">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => dismiss(id), 4500)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast stack — bottom-right */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** Call inside any component to trigger toasts. */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
