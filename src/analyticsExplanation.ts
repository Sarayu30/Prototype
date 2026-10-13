import { ANALYTICS_RECOMMENDATION_DESCRIPTION, type AnalyticsAiDiagnostics, type AnalyticsExplanationMode } from './campaignStore.ts'

type ExplanationContext = { campaignName: string; sentAt: string; reportViewTimestamps: string[] }
type ExplanationResult = { description: string; explanationMode: Exclude<AnalyticsExplanationMode, 'pending'>; aiDiagnostics: AnalyticsAiDiagnostics }

function fallbackResult(message: string, errorCode: string, attemptedAt: string, extra: Partial<AnalyticsAiDiagnostics> = {}): ExplanationResult {
  return {
    description: ANALYTICS_RECOMMENDATION_DESCRIPTION,
    explanationMode: 'fallback',
    aiDiagnostics: {
      status: 'failed',
      errorCode,
      message,
      keyConfigured: null,
      model: null,
      attemptedAt,
      completedAt: new Date().toISOString(),
      ...extra,
    },
  }
}

export async function requestAnalyticsExplanation(context: ExplanationContext, fetchImpl: typeof fetch = fetch): Promise<ExplanationResult> {
  const attemptedAt = new Date().toISOString()
  let response: Response
  try {
    response = await fetchImpl('/api/analytics-explanation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
    })
  } catch {
    return fallbackResult('Could not reach the app server API. Confirm the dev or production server is running.', 'app_api_unreachable', attemptedAt)
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return fallbackResult('The app server responded with unreadable JSON.', 'invalid_api_response', attemptedAt, { httpStatus: response.status })
  }
  if (typeof payload !== 'object' || payload === null) return fallbackResult('The app server returned an invalid response.', 'invalid_api_response', attemptedAt, { httpStatus: response.status })
  const debug = 'debug' in payload && typeof payload.debug === 'object' && payload.debug !== null ? payload.debug : null
  const diagnostic = debug && 'status' in debug && 'errorCode' in debug && 'message' in debug && 'keyConfigured' in debug && 'model' in debug
    ? debug as AnalyticsAiDiagnostics
    : null
  if (!response.ok || !('ok' in payload) || payload.ok !== true) {
    return fallbackResult(
      diagnostic?.message ?? ('error' in payload && typeof payload.error === 'string' ? payload.error : `The app server returned HTTP ${response.status}.`),
      diagnostic?.errorCode ?? 'api_request_failed',
      diagnostic?.attemptedAt ?? attemptedAt,
      { ...diagnostic, status: diagnostic?.status === 'rejected' ? 'rejected' : 'failed', httpStatus: response.status },
    )
  }
  if (!('explanation' in payload) || typeof payload.explanation !== 'string' || !payload.explanation.trim() || diagnostic?.status !== 'succeeded') {
    return fallbackResult('The server did not confirm a successful Groq explanation.', 'invalid_success_response', attemptedAt, { ...diagnostic, httpStatus: response.status })
  }
  return { description: payload.explanation.trim(), explanationMode: 'groq', aiDiagnostics: diagnostic }
}

export function createPendingAnalyticsDiagnostics(attemptedAt = new Date().toISOString()): AnalyticsAiDiagnostics {
  return { status: 'requesting', errorCode: null, message: 'Checking the server and requesting an explanation from Groq.', keyConfigured: null, model: null, attemptedAt }
}
