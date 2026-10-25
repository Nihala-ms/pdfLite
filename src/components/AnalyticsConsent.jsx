
import { useEffect, useState } from 'react'
import { BarChart3, X } from 'lucide-react'

const STORAGE_KEY = 'pdflite-analytics-choice'

function loadGoogleAnalytics(measurementId) {
  if (!measurementId || window.__pdfliteGaLoaded) return

  window.__pdfliteGaLoaded = true
  window.dataLayer = window.dataLayer || []

  window.gtag = function gtag() {
    window.dataLayer.push(arguments)
  }

  window.gtag('js', new Date())
  window.gtag('config', measurementId)

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  script.onerror = () => {
    window.__pdfliteGaLoaded = false
  }

  document.head.appendChild(script)
}

export default function AnalyticsConsent() {
  const [choice, setChoice] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'unset'
    } catch {
      return 'unset'
    }
  })

  useEffect(() => {
    window.__pdfliteAnalyticsConsent = choice === 'accepted'

    if (choice === 'accepted') {
      const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID
      loadGoogleAnalytics(measurementId)
    }
  }, [choice])

  function saveChoice(nextChoice) {
    try {
      localStorage.setItem(STORAGE_KEY, nextChoice)
    } catch {
      // Consent still applies for this page view if storage is unavailable.
    }

    setChoice(nextChoice)
  }

  if (choice !== 'unset') return null

  return (
    <aside
      aria-label="Analytics preferences"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-violet-100 bg-white p-5 shadow-2xl sm:inset-x-6 sm:bottom-6"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-violet-100 p-2 text-violet-700">
          <BarChart3 size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-slate-900">
            Help us improve PDFLite
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-600">
            With your permission, we use Google Analytics to understand
            visits and general tool usage. We do not intentionally send
            your PDF contents or file names to Analytics.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveChoice('accepted')}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Accept analytics
            </button>

            <button
              type="button"
              onClick={() => saveChoice('rejected')}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reject optional analytics
            </button>
          </div>
        </div>

        <button
          type="button"
          aria-label="Reject analytics and close"
          onClick={() => saveChoice('rejected')}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={19} />
        </button>
      </div>
    </aside>
  )
}
