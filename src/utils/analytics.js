
const ALLOWED_EVENTS = {
  tool_started: ['compression_mode'],
  optimization_completed: [
    'result_category',
    'compression_mode',
  ],
  download_clicked: [
    'result_category',
    'browser_context',
  ],
  optimization_error: ['error_type'],
}

const ALLOWED_VALUES = {
  compression_mode: [
    'smaller',
    'balanced',
    'clearer',
  ],
  result_category: [
    'excellent',
    'good',
    'small',
    'not_smaller',
  ],
  browser_context: [
    'linkedin_in_app',
    'standard_browser',
  ],
  error_type: [
    'processing_failed',
  ],
}

function sanitizeParameters(eventName, parameters) {
  const allowedKeys = ALLOWED_EVENTS[eventName]
  const safeParameters = {}

  if (!allowedKeys) {
    return safeParameters
  }

  for (const key of allowedKeys) {
    const value = parameters?.[key]

    if (
      typeof value === 'string' &&
      ALLOWED_VALUES[key]?.includes(value)
    ) {
      safeParameters[key] = value
    }
  }

  return safeParameters
}

export function trackEvent(eventName, parameters = {}) {
  if (typeof window === 'undefined') return

  // Analytics must only run after user consent.
  if (window.__pdfliteAnalyticsConsent !== true) return

  if (typeof window.gtag !== 'function') return

  if (!Object.hasOwn(ALLOWED_EVENTS, eventName)) return

  const safeParameters = sanitizeParameters(
    eventName,
    parameters,
  )

  window.gtag('event', eventName, safeParameters)
}
