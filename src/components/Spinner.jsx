import { Loader2 } from 'lucide-react'

export default function Spinner({ size = 20, className = 'text-indigo-600' }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />
}
