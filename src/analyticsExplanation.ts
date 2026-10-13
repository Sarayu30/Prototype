import { ANALYTICS_RECOMMENDATION_DESCRIPTION, type AnalyticsExplanationMode } from './campaignStore.ts'

type ExplanationContext = { campaignName: string; reportViews: number; daysSinceSend: number }
type ExplanationResult = { description: string; explanationMode: Exclude<AnalyticsExplanationMode, 'pending'> }

export async function requestAnalyticsExplanation(context: ExplanationContext, fetchImpl: typeof fetch = fetch): Promise<ExplanationResult> {
  try {
    const response = await fetchImpl('/api/analytics-explanation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
    })
    if (!response.ok) throw new Error('AI explanation unavailable')
    const payload: unknown = await response.json()
    if (typeof payload !== 'object' || payload === null || !('ok' in payload) || payload.ok !== true || !('explanation' in payload) || typeof payload.explanation !== 'string' || !payload.explanation.trim()) throw new Error('AI explanation response was invalid')
    return { description: payload.explanation.trim(), explanationMode: 'groq' }
  } catch {
    return { description: ANALYTICS_RECOMMENDATION_DESCRIPTION, explanationMode: 'fallback' }
  }
}
