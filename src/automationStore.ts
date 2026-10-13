import type { TrackedEvent, StorageLike } from './campaignStore'

export const AUTOMATION_RECOMMENDATION_STORAGE_KEY = 'cheerio:automation-recommendation'

export type AutomationRecommendationState = {
  successfulSendCount: number
  campaignIds: string[]
  qualifiedAt?: string
  dismissedAt?: string
}

export function readAutomationRecommendation(storage: StorageLike): AutomationRecommendationState {
  try {
    const value: unknown = JSON.parse(storage.getItem(AUTOMATION_RECOMMENDATION_STORAGE_KEY) ?? 'null')
    if (!value || typeof value !== 'object') return { successfulSendCount: 0, campaignIds: [] }
    const state = value as Partial<AutomationRecommendationState>
    return {
      successfulSendCount: Number.isFinite(state.successfulSendCount) ? Math.max(0, state.successfulSendCount as number) : 0,
      campaignIds: Array.isArray(state.campaignIds) ? state.campaignIds.filter((id): id is string => typeof id === 'string') : [],
      ...(typeof state.qualifiedAt === 'string' ? { qualifiedAt: state.qualifiedAt } : {}),
      ...(typeof state.dismissedAt === 'string' ? { dismissedAt: state.dismissedAt } : {}),
    }
  } catch {
    return { successfulSendCount: 0, campaignIds: [] }
  }
}

export function evaluateAutomationRecommendation(storage: StorageLike, events: TrackedEvent[]): AutomationRecommendationState {
  const previous = readAutomationRecommendation(storage)
  const campaignIds = [...new Set(events.filter((event) => event.eventName === 'campaign.sent').map((event) => event.campaignId))]
  const state: AutomationRecommendationState = {
    successfulSendCount: campaignIds.length,
    campaignIds,
    ...(campaignIds.length >= 3 ? { qualifiedAt: previous.qualifiedAt ?? new Date().toISOString() } : {}),
    ...(previous.dismissedAt ? { dismissedAt: previous.dismissedAt } : {}),
  }
  storage.setItem(AUTOMATION_RECOMMENDATION_STORAGE_KEY, JSON.stringify(state))
  return state
}

export function dismissAutomationRecommendation(storage: StorageLike): AutomationRecommendationState {
  const state = readAutomationRecommendation(storage)
  if (state.successfulSendCount < 3) return state
  const dismissed = { ...state, dismissedAt: new Date().toISOString() }
  storage.setItem(AUTOMATION_RECOMMENDATION_STORAGE_KEY, JSON.stringify(dismissed))
  return dismissed
}

export function hasAutomationRecommendation(state: AutomationRecommendationState): boolean {
  return state.successfulSendCount >= 3
}

