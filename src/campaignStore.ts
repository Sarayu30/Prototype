export const EVENT_STORAGE_KEY = 'cheerio:activity-events'
export const CAMPAIGN_STORAGE_KEY = 'cheerio:campaigns'
export const RECOMMENDATION_STORAGE_KEY = 'cheerio:recommendations'
export const DEMO_SESSION_STORAGE_KEY = 'cheerio:demo-session'
export const ANALYTICS_RECOMMENDATION_DESCRIPTION = "You've checked your results several times. Discover Analytics to spot trends more easily."
export type AnalyticsExplanationMode = 'pending' | 'groq' | 'fallback'
export type AnalyticsAiDiagnostics = {
  status: 'requesting' | 'succeeded' | 'failed' | 'rejected'
  errorCode: string | null
  message: string
  keyConfigured: boolean | null
  model: string | null
  httpStatus?: number
  attemptedAt: string
  completedAt?: string
}

export type CampaignStatus = 'draft' | 'sent'

export type Campaign = {
  id: string
  name: string
  audienceSize: number
  status: CampaignStatus
  createdAt: string
  sentAt?: string
  type?: string
  channel?: string
}

export type CampaignEventName =
  | 'campaign.created'
  | 'campaign.sent'
  | 'campaign.performance_report_viewed'

export type TrackedEvent = {
  id: string
  eventName: CampaignEventName
  campaignId: string
  description: string
  timestamp: string
  idempotencyKey: string
}

export type AnalyticsRecommendation = {
  id: string
  type: 'analytics'
  campaignId: string
  campaignName: string
  description: string
  explanationMode?: AnalyticsExplanationMode
  aiDiagnostics?: AnalyticsAiDiagnostics
  createdAt: string
  dismissedAt?: string
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function readDemoSession(storage: StorageLike): boolean {
  return storage.getItem(DEMO_SESSION_STORAGE_KEY) === 'active'
}

export function saveDemoSession(storage: StorageLike, isActive: boolean): void {
  storage.setItem(DEMO_SESSION_STORAGE_KEY, isActive ? 'active' : 'inactive')
}

type NewTrackedEvent = Omit<TrackedEvent, 'id' | 'timestamp'> & { timestamp?: string }

export function createId(prefix: string): string {
  const value = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}_${value}`
}

export function readEvents(storage: StorageLike): TrackedEvent[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(EVENT_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((event): event is TrackedEvent =>
      typeof event?.id === 'string' &&
      typeof event?.eventName === 'string' &&
      typeof event?.campaignId === 'string' &&
      typeof event?.description === 'string' &&
      typeof event?.timestamp === 'string' &&
      typeof event?.idempotencyKey === 'string',
    ).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
  } catch {
    return []
  }
}

export function recordEvent(storage: StorageLike, input: NewTrackedEvent): { events: TrackedEvent[]; event: TrackedEvent; recorded: boolean } {
  const events = readEvents(storage)
  const existing = events.find((event) => event.idempotencyKey === input.idempotencyKey)
  if (existing) return { events, event: existing, recorded: false }

  const event: TrackedEvent = {
    ...input,
    id: createId('evt'),
    timestamp: input.timestamp ?? new Date().toISOString(),
  }
  const updated = [event, ...events]
  storage.setItem(EVENT_STORAGE_KEY, JSON.stringify(updated))
  return { events: updated, event, recorded: true }
}

export function trackCampaignAction(storage: StorageLike, eventName: CampaignEventName, campaign: Campaign, actionToken?: string) {
  return recordEvent(storage, {
    eventName,
    campaignId: campaign.id,
    description: describeCampaignAction(eventName, campaign),
    idempotencyKey: `${campaign.id}:${eventName}${actionToken ? `:${actionToken}` : ''}`,
  })
}

export function shouldRecommendAnalytics(campaigns: Campaign[], events: TrackedEvent[]): boolean {
  const reportViews = events.filter((event) => event.eventName === 'campaign.performance_report_viewed')
  return campaigns.some((campaign) => {
    if (campaign.status !== 'sent' || !campaign.sentAt) return false
    const sentAt = Date.parse(campaign.sentAt)
    if (!Number.isFinite(sentAt)) return false
    const sevenDaysLater = sentAt + 7 * 24 * 60 * 60 * 1000
    const viewsInWindow = reportViews.filter((event) => {
      if (event.campaignId !== campaign.id) return false
      const viewedAt = Date.parse(event.timestamp)
      return Number.isFinite(viewedAt) && viewedAt >= sentAt && viewedAt <= sevenDaysLater
    })
    return viewsInWindow.length >= 3
  })
}

export function readRecommendations(storage: StorageLike): AnalyticsRecommendation[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(RECOMMENDATION_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((recommendation): recommendation is AnalyticsRecommendation =>
      typeof recommendation?.id === 'string' &&
      recommendation?.type === 'analytics' &&
      typeof recommendation?.campaignId === 'string' &&
      typeof recommendation?.campaignName === 'string' &&
      typeof recommendation?.description === 'string' &&
      typeof recommendation?.createdAt === 'string' &&
      (recommendation?.dismissedAt === undefined || typeof recommendation.dismissedAt === 'string'),
    )
  } catch {
    return []
  }
}

export function evaluateAnalyticsRecommendations(
  storage: StorageLike,
  campaigns: Campaign[],
  events: TrackedEvent[],
): AnalyticsRecommendation[] {
  const savedRecommendations = readRecommendations(storage)
  const recommendations = savedRecommendations.map((recommendation) => ({
    ...recommendation,
    description: recommendation.explanationMode === 'groq' ? recommendation.description : ANALYTICS_RECOMMENDATION_DESCRIPTION,
    explanationMode: recommendation.dismissedAt ? (recommendation.explanationMode ?? 'fallback') : (recommendation.explanationMode ?? 'pending'),
  }))
  const copyChanged = recommendations.some((recommendation, index) => recommendation.description !== savedRecommendations[index].description || recommendation.explanationMode !== savedRecommendations[index].explanationMode)
  const recommendedCampaignIds = new Set(recommendations.map((recommendation) => recommendation.campaignId))
  const qualifyingCampaigns = campaigns.filter((campaign) =>
    !recommendedCampaignIds.has(campaign.id) && shouldRecommendAnalytics([campaign], events),
  )

  if (qualifyingCampaigns.length === 0) {
    if (copyChanged) storage.setItem(RECOMMENDATION_STORAGE_KEY, JSON.stringify(recommendations))
    return recommendations
  }

  const newRecommendations = qualifyingCampaigns.map((campaign): AnalyticsRecommendation => ({
    id: createId('rec'),
    type: 'analytics',
    campaignId: campaign.id,
    campaignName: campaign.name,
    description: ANALYTICS_RECOMMENDATION_DESCRIPTION,
    explanationMode: 'pending',
    createdAt: new Date().toISOString(),
  }))
  const updated = [...newRecommendations, ...recommendations]
  storage.setItem(RECOMMENDATION_STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function saveAnalyticsRecommendationDiagnostics(storage: StorageLike, recommendationId: string, aiDiagnostics: AnalyticsAiDiagnostics): AnalyticsRecommendation[] {
  const recommendations = readRecommendations(storage)
  const updated = recommendations.map((recommendation) => recommendation.id === recommendationId
    ? { ...recommendation, aiDiagnostics }
    : recommendation,
  )
  storage.setItem(RECOMMENDATION_STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function saveAnalyticsRecommendationExplanation(storage: StorageLike, recommendationId: string, description: string, explanationMode: Exclude<AnalyticsExplanationMode, 'pending'>, aiDiagnostics: AnalyticsAiDiagnostics): AnalyticsRecommendation[] {
  const recommendations = readRecommendations(storage)
  const updated = recommendations.map((recommendation) => recommendation.id === recommendationId
    ? { ...recommendation, description, explanationMode, aiDiagnostics }
    : recommendation,
  )
  storage.setItem(RECOMMENDATION_STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function dismissAnalyticsRecommendation(storage: StorageLike, recommendationId: string): AnalyticsRecommendation[] {
  const recommendations = readRecommendations(storage)
  const updated = recommendations.map((recommendation) => recommendation.id === recommendationId
    ? { ...recommendation, dismissedAt: new Date().toISOString() }
    : recommendation,
  )
  storage.setItem(RECOMMENDATION_STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function readCampaigns(storage: StorageLike): Campaign[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(CAMPAIGN_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((campaign): campaign is Campaign =>
      typeof campaign?.id === 'string' &&
      typeof campaign?.name === 'string' &&
      typeof campaign?.audienceSize === 'number' &&
      (campaign?.status === 'draft' || campaign?.status === 'sent') &&
      typeof campaign?.createdAt === 'string',
    ).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  } catch {
    return []
  }
}

export function saveCampaigns(storage: StorageLike, campaigns: Campaign[]): void {
  storage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(campaigns))
}

export function describeCampaignAction(
  eventName: CampaignEventName,
  campaign: Campaign,
): string {
  switch (eventName) {
    case 'campaign.created':
      return `${campaign.name} was created as a draft.`
    case 'campaign.sent':
      return `${campaign.name} was sent to ${campaign.audienceSize} BrightPath families.`
    case 'campaign.performance_report_viewed':
      return `You viewed the performance report for ${campaign.name}.`
  }
}
