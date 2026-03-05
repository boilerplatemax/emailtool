import { useRef, useState } from 'react'
import { Upload, FileText, X } from 'lucide-react'

export default function CsvDropzone({ onFile, file, accept = '.csv' }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) onFile(dropped)
  }

  function handleChange(e) {
    const picked = e.target.files[0]
    if (picked) onFile(picked)
  }

  if (file) {
    return (
      <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
        <FileText size={18} className="text-indigo-600 shrink-0" />
        <span className="text-sm text-indigo-800 font-medium flex-1 truncate">{file.name}</span>
        <span className="text-xs text-indigo-500 shrink-0">
          {(file.size / 1024).toFixed(1)} KB
        </span>
        <button
          onClick={() => onFile(null)}
          className="text-indigo-400 hover:text-indigo-700 transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={[
        'flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-10 px-6 cursor-pointer transition-colors',
        dragging
          ? 'border-indigo-400 bg-indigo-50'
          : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50',
      ].join(' ')}
    >
      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
        <Upload size={18} className="text-slate-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-700">
          Drop your CSV here, or <span className="text-indigo-600">browse</span>
        </p>
        <p className="text-xs text-slate-400 mt-0.5">CSV files only</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
