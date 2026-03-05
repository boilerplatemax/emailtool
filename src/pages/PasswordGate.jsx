import { useState } from 'react'
import { Zap, Eye, EyeOff, Lock } from 'lucide-react'
import { authenticate } from '../utils/auth'

export default function PasswordGate({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [show, setShow]         = useState(false)
  const [error, setError]       = useState(false)
  const [shaking, setShaking]   = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (authenticate(password)) {
      onSuccess()
    } else {
      setError(true)
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className={`relative w-full max-w-sm transition-transform ${shaking ? 'animate-shake' : ''}`}>
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
              <Zap size={22} className="text-white" fill="white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">EmailTool</h1>
            <p className="text-sm text-slate-500 mt-1">Internal access only</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <Lock size={13} className="inline mr-1 mb-0.5 text-slate-400" />
                Password
              </label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(false) }}
                  placeholder="Enter access password"
                  autoFocus
                  className={[
                    'w-full rounded-lg border px-3 py-2.5 text-sm pr-10',
                    'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                    'transition-colors',
                    error
                      ? 'border-red-300 bg-red-50 text-red-900 placeholder-red-300'
                      : 'border-slate-200 bg-white text-slate-900 placeholder-slate-400',
                  ].join(' ')}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {error && (
                <p className="text-xs text-red-500 mt-1.5">Incorrect password. Try again.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!password}
              className="w-full bg-indigo-600 text-white font-medium text-sm py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>

      {/* Shake keyframe injected inline for simplicity */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-5px); }
          80%       { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  )
}
