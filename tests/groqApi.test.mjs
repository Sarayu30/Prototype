import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createGroqApiHandler, generateAnalyticsExplanation, loadGroqEnv } from '../server/groq-api.mjs'
import { requestAnalyticsExplanation } from '../src/analyticsExplanation.ts'

function qualifyingRequest() {
  const sentAt = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return {
    campaignName: 'Family Update',
    sentAt: sentAt.toISOString(),
    reportViewTimestamps: [0, 1, 2].map((hours) => new Date(sentAt.getTime() + hours * 60 * 60 * 1000).toISOString()),
  }
}

test('loads the Groq key server-side from .env without overwriting an existing environment value', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cheerio-env-'))
  try {
    const envPath = path.join(directory, '.env')
    await writeFile(envPath, 'GROQ_API_KEY="demo-secret-value"\nGROQ_MODEL=llama-test\n')
    const target = {}
    assert.equal(await loadGroqEnv(envPath, target), true)
    assert.equal(target.GROQ_API_KEY, 'demo-secret-value')
    assert.equal(target.GROQ_MODEL, 'llama-test')
    target.GROQ_API_KEY = 'already-set'
    await loadGroqEnv(envPath, target)
    assert.equal(target.GROQ_API_KEY, 'already-set')
    target.GROQ_API_KEY = ''
    assert.equal(await loadGroqEnv(envPath, target), true)
    assert.equal(target.GROQ_API_KEY, 'demo-secret-value')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('Groq completion helper sends the key only as a server-side bearer header', async () => {
  let request
  const result = await generateAnalyticsExplanation({ campaignName: 'Family Update', reportViews: 3, daysSinceSend: 2 }, {
    apiKey: 'private-test-key',
    fetchImpl: async (url, options) => {
      request = { url, options }
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'Analytics can help you compare this family update with future campaigns.' } }] }) }
    },
  })
  assert.equal(result, 'Analytics can help you compare this family update with future campaigns.')
  assert.equal(request.url, 'https://api.groq.com/openai/v1/chat/completions')
  assert.equal(request.options.headers.Authorization, 'Bearer private-test-key')
  assert.equal(JSON.stringify(request.options.body).includes('private-test-key'), false)
})

test('server handler rejects unqualified activity before calling Groq and hides provider errors', async () => {
  let called = false
  const handler = createGroqApiHandler({ apiKey: 'private-test-key', fetchImpl: async () => { called = true; throw new Error('provider included secret private-test-key') } })
  const invoke = (payload) => new Promise((resolve) => {
    const request = { url: '/api/analytics-explanation', method: 'POST', async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(payload)) } }
    const response = { writeHead(status, headers) { this.status = status; this.headers = headers }, end(body) { resolve({ status: this.status, headers: this.headers, body: JSON.parse(body) }) } }
    handler(request, response)
  })
  const qualified = qualifyingRequest()
  const invalid = await invoke({ ...qualified, reportViewTimestamps: qualified.reportViewTimestamps.slice(0, 2) })
  assert.equal(invalid.status, 400)
  assert.equal(invalid.body.debug.status, 'rejected')
  assert.equal(invalid.body.debug.keyConfigured, true)
  assert.equal(called, false)
  const failed = await invoke(qualified)
  assert.equal(failed.status, 502)
  assert.equal(JSON.stringify(failed.body).includes('private-test-key'), false)
  assert.equal(failed.headers['Cache-Control'], 'no-store')
  assert.equal(failed.body.debug.errorCode, 'network_error')
  assert.equal(failed.body.debug.keyConfigured, true)
  assert.equal(failed.body.debug.model, 'openai/gpt-oss-120b')
})

test('server identifies a missing .env key without attempting the Groq request', async () => {
  let called = false
  const handler = createGroqApiHandler({ apiKey: '', fetchImpl: async () => { called = true } })
  const result = await new Promise((resolve) => {
    const request = { url: '/api/analytics-explanation', method: 'POST', async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(qualifyingRequest())) } }
    const response = { writeHead(status) { this.status = status }, end(body) { resolve({ status: this.status, body: JSON.parse(body) }) } }
    handler(request, response)
  })
  assert.equal(result.status, 503)
  assert.equal(result.body.debug.errorCode, 'missing_api_key')
  assert.equal(result.body.debug.keyConfigured, false)
  assert.equal(called, false)
})

test('server returns the generated explanation and safe success diagnostics after qualification', async () => {
  let called = false
  const handler = createGroqApiHandler({ apiKey: 'private-test-key', fetchImpl: async () => {
    called = true
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'Analytics can help compare this update with your next campaign.' } }] }) }
  } })
  const result = await new Promise((resolve) => {
    const request = { url: '/api/analytics-explanation', method: 'POST', async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(qualifyingRequest())) } }
    const response = { writeHead(status) { this.status = status }, end(body) { resolve({ status: this.status, body: JSON.parse(body) }) } }
    handler(request, response)
  })
  assert.equal(called, true)
  assert.equal(result.status, 200)
  assert.equal(result.body.ok, true)
  assert.match(result.body.explanation, /compare this update/)
  assert.equal(result.body.debug.status, 'succeeded')
  assert.equal(result.body.debug.keyConfigured, true)
  assert.equal(JSON.stringify(result.body).includes('private-test-key'), false)
})

test('client reports Groq only on a successful response and uses the fallback on failure', async () => {
  const context = qualifyingRequest()
  const success = await requestAnalyticsExplanation(context, async () => ({ ok: true, status: 200, json: async () => ({ ok: true, explanation: 'Analytics can help you spot a pattern in this campaign.', debug: { status: 'succeeded', errorCode: null, message: 'Groq returned a personalized explanation.', keyConfigured: true, model: 'openai/gpt-oss-120b', httpStatus: 200, attemptedAt: new Date().toISOString() } }) }))
  assert.equal(success.explanationMode, 'groq')
  assert.equal(success.description, 'Analytics can help you spot a pattern in this campaign.')
  const fallback = await requestAnalyticsExplanation(context, async () => ({ ok: false, status: 502, json: async () => ({ ok: false, error: 'The server could not reach api.groq.com.', debug: { status: 'failed', errorCode: 'network_error', message: 'The server could not reach api.groq.com. Check server network access.', keyConfigured: true, model: 'openai/gpt-oss-120b', httpStatus: 502, attemptedAt: new Date().toISOString() } }) }))
  assert.equal(fallback.explanationMode, 'fallback')
  assert.match(fallback.description, /checked your results several times/)
  assert.equal(fallback.aiDiagnostics.errorCode, 'network_error')
  assert.equal(fallback.aiDiagnostics.keyConfigured, true)
})
