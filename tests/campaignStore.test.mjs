import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CAMPAIGN_STORAGE_KEY,
  DEMO_SESSION_STORAGE_KEY,
  EVENT_STORAGE_KEY,
  RECOMMENDATION_STORAGE_KEY,
  createId,
  dismissAnalyticsRecommendation,
  evaluateAnalyticsRecommendations,
  readCampaigns,
  readDemoSession,
  readEvents,
  readRecommendations,
  saveAnalyticsRecommendationExplanation,
  saveCampaigns,
  saveDemoSession,
  trackCampaignAction,
  shouldRecommendAnalytics,
} from '../src/campaignStore.ts'
import { pathForSection, sectionForPath, sections } from '../src/navigation.ts'
import {
  ANALYTICS_SETUP_STORAGE_KEY,
  activateAnalyticsSetup,
  readAnalyticsSetup,
  startAnalyticsSetup,
  updateAnalyticsSetup,
} from '../src/analyticsSetup.ts'

class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
}

const campaignId = 'cmp_demo_campaign'
const campaign = {
  id: campaignId,
  name: 'Study tips',
  audienceSize: 128,
  status: 'sent',
  createdAt: '2026-10-13T06:25:00.000Z',
}

test('stores each campaign action with a unique ID and a realistic timestamp', () => {
  const storage = new MemoryStorage()
  const actionStartedAt = Date.now()
  const actions = ['campaign.created', 'campaign.sent', 'campaign.performance_report_viewed']

  for (const action of actions) assert.equal(trackCampaignAction(storage, action, campaign).recorded, true)

  const events = readEvents(storage)
  assert.equal(events.length, 3)
  assert.deepEqual(new Set(events.map((event) => event.eventName)), new Set(actions))
  assert.equal(new Set(events.map((event) => event.id)).size, 3)
  assert.ok(events.every((event) => Number.isFinite(Date.parse(event.timestamp))))
  assert.ok(events.every((event) => Math.abs(Date.parse(event.timestamp) - actionStartedAt) < 5000))
  assert.equal(JSON.parse(storage.getItem(EVENT_STORAGE_KEY)).length, 3)
})

test('re-recording an action with the same idempotency key does not duplicate it', () => {
  const storage = new MemoryStorage()

  const first = trackCampaignAction(storage, 'campaign.sent', campaign)
  const second = trackCampaignAction(storage, 'campaign.sent', campaign)

  assert.equal(first.recorded, true)
  assert.equal(second.recorded, false)
  assert.equal(second.event.id, first.event.id)
  assert.equal(readEvents(storage).length, 1)
})

test('events survive reloads and malformed saved data is handled safely', () => {
  const storage = new MemoryStorage()
  trackCampaignAction(storage, 'campaign.created', campaign)
  assert.equal(readEvents(storage).length, 1)

  storage.setItem(EVENT_STORAGE_KEY, '{not json')
  assert.deepEqual(readEvents(storage), [])
})

test('demo login session survives refresh and logout clears it', () => {
  const storage = new MemoryStorage()
  assert.equal(readDemoSession(storage), false)
  saveDemoSession(storage, true)
  assert.equal(storage.getItem(DEMO_SESSION_STORAGE_KEY), 'active')
  assert.equal(readDemoSession(storage), true)
  saveDemoSession(storage, false)
  assert.equal(readDemoSession(storage), false)
})

test('sidebar sections have stable individual URLs and resolve on refresh or history navigation', () => {
  const expectedPaths = ['/dashboard', '/campaigns', '/student-leads', '/conversations', '/analytics', '/recommendations', '/activated-features']
  assert.deepEqual(sections.map(pathForSection), expectedPaths)
  assert.deepEqual(expectedPaths.map(sectionForPath), sections)
  assert.equal(sectionForPath('/campaigns/'), 'Campaigns')
  assert.equal(sectionForPath('/not-a-section'), null)
})

test('Analytics setup saves progress, resumes the same step and values, and persists activation', () => {
  const storage = new MemoryStorage()
  const started = startAnalyticsSetup(storage)
  const withMetrics = updateAnalyticsSetup(storage, started, { metrics: ['opens', 'clicks'] })
  const stepTwo = updateAnalyticsSetup(storage, withMetrics, { step: 2 })
  const savedBeforeLeaving = readAnalyticsSetup(storage)
  assert.deepEqual(savedBeforeLeaving, stepTwo)

  const resumed = startAnalyticsSetup(storage)
  assert.deepEqual(resumed, stepTwo)
  const withFrequency = updateAnalyticsSetup(storage, resumed, { frequency: 'monthly' })
  const activated = activateAnalyticsSetup(storage, withFrequency)
  assert.equal(activated.status, 'activated')
  assert.equal(activated.step, 2)
  assert.deepEqual(activated.metrics, ['opens', 'clicks'])
  assert.equal(activated.frequency, 'monthly')
  assert.deepEqual(readAnalyticsSetup(storage), activated)
  assert.equal(JSON.parse(storage.getItem(ANALYTICS_SETUP_STORAGE_KEY)).status, 'activated')
})

test('campaign drafts and sent status survive reloads', () => {
  const storage = new MemoryStorage()
  const draft = { ...campaign, status: 'draft', sentAt: undefined }
  saveCampaigns(storage, [draft])
  assert.equal(readCampaigns(storage)[0].status, 'draft')

  const sent = { ...draft, status: 'sent', sentAt: '2026-10-13T06:30:00.000Z' }
  saveCampaigns(storage, [sent])
  assert.equal(readCampaigns(storage)[0].status, 'sent')
  assert.equal(readCampaigns(storage)[0].sentAt, sent.sentAt)
  assert.equal(JSON.parse(storage.getItem(CAMPAIGN_STORAGE_KEY)).length, 1)
})

test('campaign workflow persists a draft, sends it once, and records every report opening', () => {
  const storage = new MemoryStorage()
  const createdAt = new Date().toISOString()
  const draft = { ...campaign, status: 'draft', createdAt, sentAt: undefined }

  saveCampaigns(storage, [draft])
  const created = trackCampaignAction(storage, 'campaign.created', draft)
  assert.equal(created.recorded, true)

  const sent = { ...draft, status: 'sent', sentAt: new Date().toISOString() }
  saveCampaigns(storage, [sent])
  const sentEvent = trackCampaignAction(storage, 'campaign.sent', sent)
  const duplicateSend = trackCampaignAction(storage, 'campaign.sent', sent)
  assert.equal(sentEvent.recorded, true)
  assert.equal(duplicateSend.recorded, false)

  const firstReport = trackCampaignAction(storage, 'campaign.performance_report_viewed', sent, createId('view'))
  const secondReport = trackCampaignAction(storage, 'campaign.performance_report_viewed', sent, createId('view'))
  assert.equal(firstReport.recorded, true)
  assert.equal(secondReport.recorded, true)

  const reloadedCampaigns = readCampaigns(storage)
  const reloadedEvents = readEvents(storage)
  assert.equal(reloadedCampaigns[0].status, 'sent')
  assert.equal(reloadedCampaigns[0].sentAt, sent.sentAt)
  assert.equal(reloadedEvents.length, 4)
  assert.equal(new Set(reloadedEvents.map((event) => event.id)).size, 4)
  assert.ok(reloadedEvents.every((event) => Number.isFinite(Date.parse(event.timestamp))))
  assert.ok(reloadedEvents.some((event) => event.description === 'Study tips was created as a draft.'))
  assert.ok(reloadedEvents.some((event) => event.description === 'Study tips was sent to 128 BrightPath families.'))
  assert.equal(reloadedEvents.filter((event) => event.eventName === 'campaign.performance_report_viewed').length, 2)
})

test('event IDs are distinct', () => {
  assert.notEqual(createId('evt'), createId('evt'))
})


test('separate report openings are tracked once each and repeated handling is deduplicated', () => {
  const storage = new MemoryStorage()
  const first = trackCampaignAction(storage, 'campaign.performance_report_viewed', campaign, 'open-one')
  const repeatedHandler = trackCampaignAction(storage, 'campaign.performance_report_viewed', campaign, 'open-one')
  const second = trackCampaignAction(storage, 'campaign.performance_report_viewed', campaign, 'open-two')
  const third = trackCampaignAction(storage, 'campaign.performance_report_viewed', campaign, 'open-three')

  assert.equal(first.recorded, true)
  assert.equal(repeatedHandler.recorded, false)
  assert.equal(second.recorded, true)
  assert.equal(third.recorded, true)
  const events = readEvents(storage)
  assert.equal(events.length, 3)
  assert.equal(new Set(events.map((event) => event.id)).size, 3)
  assert.ok(events.every((event) => Number.isFinite(Date.parse(event.timestamp))))
  assert.ok(events.every((event, index) => index === 0 || Date.parse(events[index - 1].timestamp) >= Date.parse(event.timestamp)))
})

test('recommends Analytics after three report views within seven days of sending', () => {
  const sentCampaign = { ...campaign, sentAt: '2026-10-01T12:00:00.000Z' }
  const reportView = (id, timestamp) => ({
    id,
    eventName: 'campaign.performance_report_viewed',
    campaignId: sentCampaign.id,
    description: 'Viewed campaign report.',
    timestamp,
    idempotencyKey: id,
  })
  const views = [
    reportView('view-1', '2026-10-01T13:00:00.000Z'),
    reportView('view-2', '2026-10-03T10:00:00.000Z'),
    reportView('view-3', '2026-10-08T12:00:00.000Z'),
  ]

  assert.equal(shouldRecommendAnalytics([sentCampaign], views.slice(0, 2)), false)
  assert.equal(shouldRecommendAnalytics([sentCampaign], views), true)
  assert.equal(shouldRecommendAnalytics([sentCampaign], [
    ...views.slice(0, 2),
    reportView('view-late', '2026-10-08T12:00:01.000Z'),
  ]), false)
  assert.equal(shouldRecommendAnalytics([campaign], views), false)
})

test('automatically persists one recommendation at three report views, but not one or two', () => {
  const storage = new MemoryStorage()
  const sent = { ...campaign, sentAt: new Date().toISOString() }
  saveCampaigns(storage, [sent])
  trackCampaignAction(storage, 'campaign.sent', sent)

  const recommendationsAfter = (viewCount) => {
    for (let index = 0; index < viewCount; index += 1) {
      const action = trackCampaignAction(storage, 'campaign.performance_report_viewed', sent, createId('view'))
      evaluateAnalyticsRecommendations(storage, readCampaigns(storage), action.events)
    }
    return readRecommendations(storage)
  }

  assert.equal(recommendationsAfter(1).length, 0)
  assert.equal(recommendationsAfter(1).length, 0)
  const qualified = recommendationsAfter(1)
  assert.equal(qualified.length, 1)
  assert.equal(qualified[0].campaignId, sent.id)
  assert.equal(qualified[0].description, "You've checked your results several times. Discover Analytics to spot trends more easily.")
  assert.ok(Number.isFinite(Date.parse(qualified[0].createdAt)))

  evaluateAnalyticsRecommendations(storage, readCampaigns(storage), readEvents(storage))
  assert.equal(readRecommendations(storage).length, 1)
  assert.equal(JSON.parse(storage.getItem(RECOMMENDATION_STORAGE_KEY)).length, 1)
})

test('rule reevaluation preserves the successful Groq explanation across reloads and later campaign actions', () => {
  const storage = new MemoryStorage()
  const sent = { ...campaign, sentAt: new Date().toISOString() }
  saveCampaigns(storage, [sent])
  let events = []
  for (let index = 0; index < 3; index += 1) {
    events = trackCampaignAction(storage, 'campaign.performance_report_viewed', sent, `view-${index}`).events
  }
  const recommendation = evaluateAnalyticsRecommendations(storage, [sent], events)[0]
  const diagnostics = { status: 'succeeded', errorCode: null, message: 'Groq returned a personalized explanation.', keyConfigured: true, model: 'openai/gpt-oss-120b', httpStatus: 200, attemptedAt: new Date().toISOString() }
  saveAnalyticsRecommendationExplanation(storage, recommendation.id, 'Analytics can help you compare this campaign with future updates.', 'groq', diagnostics)

  const reloaded = evaluateAnalyticsRecommendations(storage, [sent], events)[0]
  assert.equal(reloaded.description, 'Analytics can help you compare this campaign with future updates.')
  assert.equal(reloaded.explanationMode, 'groq')
  assert.equal(reloaded.aiDiagnostics.keyConfigured, true)
  assert.equal(JSON.stringify(reloaded).includes('private-test-key'), false)
})

test('report views after the seven-day window do not create an Analytics recommendation', () => {
  const storage = new MemoryStorage()
  const sentAt = '2026-10-01T12:00:00.000Z'
  const sent = { ...campaign, sentAt }
  const lateViews = [
    '2026-10-08T12:00:01.000Z',
    '2026-10-08T12:01:00.000Z',
    '2026-10-08T12:02:00.000Z',
  ].map((timestamp, index) => ({
    id: `evt-late-${index}`,
    eventName: 'campaign.performance_report_viewed',
    campaignId: sent.id,
    description: 'Viewed campaign report.',
    timestamp,
    idempotencyKey: `view-late-${index}`,
  }))

  assert.equal(evaluateAnalyticsRecommendations(storage, [sent], lateViews).length, 0)
  assert.deepEqual(readRecommendations(storage), [])
})

test('Not now persists dismissal without removing the recommendation from its page data', () => {
  const storage = new MemoryStorage()
  const sent = { ...campaign, sentAt: new Date().toISOString() }
  saveCampaigns(storage, [sent])
  for (let index = 0; index < 3; index += 1) {
    const action = trackCampaignAction(storage, 'campaign.performance_report_viewed', sent, createId('view'))
    evaluateAnalyticsRecommendations(storage, [sent], action.events)
  }

  const created = readRecommendations(storage)
  const dismissed = dismissAnalyticsRecommendation(storage, created[0].id)
  assert.equal(dismissed.length, 1)
  assert.ok(Number.isFinite(Date.parse(dismissed[0].dismissedAt)))
  assert.equal(readRecommendations(storage)[0].id, created[0].id)
  assert.equal(evaluateAnalyticsRecommendations(storage, [sent], readEvents(storage)).length, 1)
  assert.ok(readRecommendations(storage)[0].dismissedAt)
})
