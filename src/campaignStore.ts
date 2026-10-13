export const EVENT_STORAGE_KEY = 'cheerio:activity-events'
export const CAMPAIGN_STORAGE_KEY = 'cheerio:campaigns'

export type CampaignStatus = 'draft' | 'sent'

export type Campaign = {
  id: string
  name: string
  audienceSize: number
  status: CampaignStatus
  createdAt: string
  sentAt?: string
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

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

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

export function trackCampaignAction(storage: StorageLike, eventName: CampaignEventName, campaign: Campaign) {
  return recordEvent(storage, {
    eventName,
    campaignId: campaign.id,
    description: describeCampaignAction(eventName, campaign),
    idempotencyKey: `${campaign.id}:${eventName}`,
  })
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
