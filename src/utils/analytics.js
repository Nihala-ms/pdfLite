
export function trackEvent(eventName, parameters = {}) {
  if (typeof window === 'undefined') return
  if (window.__pdfliteAnalyticsConsent !== true) return
  if (typeof window.gtag !== 'function') return

  const allowedEvents = new Set([
    'tool_started',
    'optimization_completed',
    'download_completed',
    'optimization_error',
  ])

  if (!allowedEvents.has(eventName)) return

  window.gtag('event', eventName, parameters)
}
