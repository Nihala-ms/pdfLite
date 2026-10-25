
import { ShieldCheck, FileText } from 'lucide-react'

export default function Header() {
  return (
    <header className="border-b border-violet-100 bg-white/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <a href="/" className="flex items-center gap-3" aria-label="PDFLite home">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200">
            <FileText size={23} />
          </span>
          <span>
            <span className="block text-xl font-extrabold tracking-tight text-slate-900">
              PDF<span className="text-violet-600">Lite</span>
            </span>
            <span className="block text-xs text-slate-500">
              Simple. Private. Online.
            </span>
          </span>
        </a>

        <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 sm:flex">
          <ShieldCheck size={17} />
          Files stay on your device
        </div>

        <a
          href="#how-it-works"
          className="text-sm font-semibold text-slate-600 transition hover:text-violet-600"
        >
          How it works
        </a>
      </div>
    </header>
  )
}
