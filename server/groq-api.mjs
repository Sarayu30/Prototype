import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'openai/gpt-oss-20b'
const AVAILABLE_MODEL_FALLBACK = 'openai/gpt-oss-120b'

export async function loadGroqEnv(envFile = path.join(projectRoot, '.env'), target = process.env) {
  let contents
  try {
    contents = await readFile(envFile, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
  for (const line of contents.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!match || (typeof target[match[1]] === 'string' && target[match[1]].trim())) continue
    let value = match[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    else value = value.replace(/\s+#.*$/, '')
    target[match[1]] = value.replace(/\\n/g, '\n')
  }
  return Boolean(typeof target.GROQ_API_KEY === 'string' && target.GROQ_API_KEY.trim())
}

function codedError(code, message, httpStatus) {
  return Object.assign(new Error(message), { code, httpStatus })
}

async function requestModelExplanation({ campaignName, reportViews, daysSinceSend }, model, fetchImpl, apiKey) {
  let response
  try {
    response = await fetchImpl(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_completion_tokens: 240,
        messages: [
          { role: 'system', content: 'Write a concise, friendly, personalized explanation (one or two sentences) of how Analytics may help a school administrator understand campaign results. Only use the supplied facts. Do not claim results or features that were not provided. Return only the explanation.' },
          { role: 'user', content: JSON.stringify({ campaignName, reportViews, daysSinceSend }) },
        ],
      }),
    })
  } catch {
    throw codedError('network_error', 'The server could not reach the Groq API')
  }
  if (!response.ok) throw codedError('provider_http_error', `Groq returned HTTP ${response.status}`, response.status)
  let data
  try {
    data = await response.json()
  } catch {
    throw codedError('invalid_provider_response', 'Groq returned an unreadable response', response.status)
  }
  const explanation = data?.choices?.[0]?.message?.content?.trim()
  if (typeof explanation !== 'string' || explanation.length === 0) throw codedError('empty_provider_response', 'Groq returned no explanation text', response.status)
  return explanation.slice(0, 600)
}

export async function generateAnalyticsExplanation({ campaignName, reportViews, daysSinceSend }, options = {}) {
  const apiKey = options.apiKey ?? process.env.GROQ_API_KEY
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw codedError('missing_api_key', 'GROQ_API_KEY is not configured on the server')
  const fetchImpl = options.fetchImpl ?? fetch
  const requestedModel = options.model ?? process.env.GROQ_MODEL ?? DEFAULT_MODEL
  try {
    const explanation = await requestModelExplanation({ campaignName, reportViews, daysSinceSend }, requestedModel, fetchImpl, apiKey)
    return { explanation, requestedModel, model: requestedModel, modelFallback: false }
  } catch (error) {
    if (requestedModel !== DEFAULT_MODEL || error?.code !== 'provider_http_error' || error?.httpStatus !== 404) throw error
  }
  try {
    const explanation = await requestModelExplanation({ campaignName, reportViews, daysSinceSend }, AVAILABLE_MODEL_FALLBACK, fetchImpl, apiKey)
    return { explanation, requestedModel, model: AVAILABLE_MODEL_FALLBACK, modelFallback: true }
  } catch (error) {
    error.requestedModel = requestedModel
    error.failedModel = AVAILABLE_MODEL_FALLBACK
    error.modelFallback = true
    throw error
  }
}

async function readRequestBody(request, maximumBytes = 8192) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (Buffer.byteLength(body) > maximumBytes) throw Object.assign(new Error('Request too large'), { statusCode: 413, code: 'request_too_large' })
  }
  return JSON.parse(body || '{}')
}

export function createGroqApiHandler(options = {}) {
  return async function groqApiHandler(request, response, next = () => {}) {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    if (pathname !== '/api/analytics-explanation') return next()
    if (request.method !== 'POST') {
      response.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' })
      response.end(JSON.stringify({ ok: false, error: 'Method not allowed' }))
      return
    }
    const configuredKey = options.apiKey ?? process.env.GROQ_API_KEY
    const keyConfigured = typeof configuredKey === 'string' && Boolean(configuredKey.trim())
    const model = options.model ?? process.env.GROQ_MODEL ?? DEFAULT_MODEL
    const attemptedAt = new Date().toISOString()
    try {
      const body = await readRequestBody(request)
      const sentAt = typeof body.sentAt === 'string' ? Date.parse(body.sentAt) : Number.NaN
      const reportViewTimestamps = Array.isArray(body.reportViewTimestamps) && body.reportViewTimestamps.length <= 100
        ? body.reportViewTimestamps.map((timestamp) => typeof timestamp === 'string' ? Date.parse(timestamp) : Number.NaN)
        : []
      const qualifyingViewCount = reportViewTimestamps.filter((viewedAt) => Number.isFinite(viewedAt) && viewedAt >= sentAt && viewedAt <= sentAt + 7 * 24 * 60 * 60 * 1000).length
      if (typeof body.campaignName !== 'string' || !body.campaignName.trim() || body.campaignName.length > 100 || !Number.isFinite(sentAt) || qualifyingViewCount < 3) {
        response.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        response.end(JSON.stringify({ ok: false, error: 'Analytics recommendation rules have not qualified.', debug: { status: 'rejected', errorCode: 'unqualified_context', message: 'Groq was not called: the campaign needs three report views within seven days of sending.', keyConfigured, model, httpStatus: 400, attemptedAt, completedAt: new Date().toISOString() } }))
        return
      }
      const daysSinceSend = Math.min(7, Math.max(0, Math.floor((Date.now() - sentAt) / (24 * 60 * 60 * 1000))))
      const generated = await generateAnalyticsExplanation({ campaignName: body.campaignName, reportViews: qualifyingViewCount, daysSinceSend }, options)
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      const message = generated.modelFallback
        ? `Requested model ${generated.requestedModel} was unavailable; Groq generated the explanation with ${generated.model}.`
        : `Groq generated the explanation with ${generated.model}.`
      response.end(JSON.stringify({ ok: true, explanation: generated.explanation, debug: { status: 'succeeded', errorCode: null, message, keyConfigured, model: generated.model, requestedModel: generated.requestedModel, modelFallback: generated.modelFallback, httpStatus: 200, attemptedAt, completedAt: new Date().toISOString() } }))
    } catch (error) {
      const status = error?.statusCode ?? (error?.code === 'missing_api_key' || !keyConfigured ? 503 : 502)
      const errorCode = error?.code ?? 'request_error'
      const message = errorCode === 'missing_api_key'
        ? 'The server did not load GROQ_API_KEY from its environment.'
        : errorCode === 'network_error'
          ? 'The server could not reach api.groq.com. Check server network access.'
          : errorCode === 'provider_http_error'
            ? `Groq rejected the request with HTTP ${error.httpStatus}. Check the configured model and key access.`
            : errorCode === 'empty_provider_response' || errorCode === 'invalid_provider_response'
              ? 'Groq responded, but did not return usable explanation text.'
              : errorCode === 'request_too_large'
                ? 'The request body exceeded the allowed size.'
                : 'The server could not generate an AI explanation.'
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify({ ok: false, error: message, debug: { status: 'failed', errorCode, message, keyConfigured, model: error?.failedModel ?? model, requestedModel: error?.requestedModel ?? model, modelFallback: Boolean(error?.modelFallback), httpStatus: error?.httpStatus ?? status, attemptedAt, completedAt: new Date().toISOString() } }))
    }
  }
}
