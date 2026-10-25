
import { useRef, useState } from 'react'
import { FileUp, FolderOpen, ShieldCheck } from 'lucide-react'

export default function UploadZone({
  onFileSelected,
  disabled = false,
  error = '',
}) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleFiles(files) {
    const file = files?.[0]
    if (file) onFileSelected(file)

    // Allow selecting the same file again.
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragging(false)

    if (!disabled) {
      handleFiles(event.dataTransfer.files)
    }
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-3xl border-2 border-dashed p-8 text-center transition sm:p-12 ${
          isDragging
            ? 'border-violet-500 bg-violet-100'
            : 'border-violet-200 bg-violet-50/60 hover:border-violet-400 hover:bg-violet-50'
        } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm">
          <FileUp size={32} />
        </div>

        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Drop your PDF here
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Or select a PDF file from your device
        </p>

        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FolderOpen size={19} />
          Choose PDF
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          aria-label="Choose a PDF file"
          disabled={disabled}
          onChange={(event) => handleFiles(event.target.files)}
        />

        <p className="mt-4 text-xs text-slate-500">
          PDF files only · Maximum file size: 100 MB
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
        <ShieldCheck size={17} className="text-emerald-600" />
        Your PDF is processed locally in your browser.
      </p>
    </div>
  )
}
