import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dismissAutomationRecommendation,
  evaluateAutomationRecommendation,
  hasAutomationRecommendation,
  readAutomationRecommendation,
} from '../src/automationStore.ts'
import {
  activateAutomations,
  readAutomationsSetup,
  startAutomationsSetup,
  updateAutomationsSetup,
} from '../src/automationsSetup.ts'

class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
}

function createdEvents(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `event-${index}`,
    eventName: 'campaign.created',
    campaignId: `campaign-${index}`,
    description: `Sent campaign ${index}`,
    timestamp: new Date(Date.UTC(2026, 9, 13, 10, index)).toISOString(),
    idempotencyKey: `campaign.sent:campaign-${index}`,
  }))
}

test('Automations qualifies after three distinct created campaigns and persists the count', () => {
  const storage = new MemoryStorage()
  assert.equal(hasAutomationRecommendation(evaluateAutomationRecommendation(storage, [])), false)
  assert.equal(hasAutomationRecommendation(evaluateAutomationRecommendation(storage, createdEvents(2))), false)

  const qualified = evaluateAutomationRecommendation(storage, createdEvents(3))
  assert.equal(hasAutomationRecommendation(qualified), true)
  assert.equal(qualified.createdCampaignCount, 3)
  assert.equal(readAutomationRecommendation(storage).createdCampaignCount, 3)

  // Duplicate delivery of the same creation event must not add another campaign.
  assert.equal(evaluateAutomationRecommendation(storage, [...createdEvents(3), createdEvents(3)[0]]).createdCampaignCount, 3)
})

test('Not now dismissal persists while the recommendation remains available to Recommendations', () => {
  const storage = new MemoryStorage()
  evaluateAutomationRecommendation(storage, createdEvents(3))
  const dismissed = dismissAutomationRecommendation(storage)
  assert.ok(dismissed.dismissedAt)
  assert.equal(hasAutomationRecommendation(readAutomationRecommendation(storage)), true)
  assert.ok(readAutomationRecommendation(storage).dismissedAt)
})

test('Automations setup saves step and choices for resume, then persists activation', () => {
  const storage = new MemoryStorage()
  const started = startAutomationsSetup(storage)
  const stepTwo = updateAutomationsSetup(storage, started, { step: 2, trigger: 'report-viewed', action: 'prepare-follow-up' })
  const resumed = readAutomationsSetup(storage)
  assert.deepEqual(resumed, stepTwo)
  assert.equal(resumed.step, 2)
  assert.equal(resumed.trigger, 'report-viewed')
  assert.equal(resumed.action, 'prepare-follow-up')
  assert.equal(activateAutomations(storage, resumed).status, 'activated')
  assert.equal(readAutomationsSetup(storage).status, 'activated')
})
