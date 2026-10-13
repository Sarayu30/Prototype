import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createGroqApiHandler, generateAnalyticsExplanation, loadGroqEnv } from '../server/groq-api.mjs'
import { requestAnalyticsExplanation } from '../src/analyticsExplanation.ts'

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
  const invalid = await invoke({ campaignName: 'Family Update', reportViews: 2, daysSinceSend: 2 })
  assert.equal(invalid.status, 400)
  assert.equal(called, false)
  const failed = await invoke({ campaignName: 'Family Update', reportViews: 3, daysSinceSend: 2 })
  assert.equal(failed.status, 502)
  assert.equal(JSON.stringify(failed.body).includes('private-test-key'), false)
  assert.equal(failed.headers['Cache-Control'], 'no-store')
})

test('client reports Groq only on a successful response and uses the fallback on failure', async () => {
  const context = { campaignName: 'Family Update', reportViews: 3, daysSinceSend: 2 }
  const success = await requestAnalyticsExplanation(context, async () => ({ ok: true, json: async () => ({ ok: true, explanation: 'Analytics can help you spot a pattern in this campaign.' }) }))
  assert.equal(success.explanationMode, 'groq')
  assert.equal(success.description, 'Analytics can help you spot a pattern in this campaign.')
  const fallback = await requestAnalyticsExplanation(context, async () => ({ ok: false, json: async () => ({}) }))
  assert.equal(fallback.explanationMode, 'fallback')
  assert.match(fallback.description, /checked your results several times/)
})
