import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EVENT_STORAGE_KEY,
  createId,
  readEvents,
  trackCampaignAction,
} from '../src/campaignStore.ts'

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

test('event IDs are distinct', () => {
  assert.notEqual(createId('evt'), createId('evt'))
})
