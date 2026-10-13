import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'openai/gpt-oss-120b'

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
    if (!match || Object.hasOwn(target, match[1])) continue
    let value = match[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    else value = value.replace(/\s+#.*$/, '')
    target[match[1]] = value.replace(/\\n/g, '\n')
  }
  return Boolean(target.GROQ_API_KEY)
}

export async function generateAnalyticsExplanation({ campaignName, reportViews, daysSinceSend }, options = {}) {
  const apiKey = options.apiKey ?? process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('Groq API key is not configured')
  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model ?? process.env.GROQ_MODEL ?? DEFAULT_MODEL,
      temperature: 0.4,
      max_completion_tokens: 240,
      messages: [
        { role: 'system', content: 'Write a concise, friendly, personalized explanation (one or two sentences) of how Analytics may help a school administrator understand campaign results. Only use the supplied facts. Do not claim results or features that were not provided. Return only the explanation.' },
        { role: 'user', content: JSON.stringify({ campaignName, reportViews, daysSinceSend }) },
      ],
    }),
  })
  if (!response.ok) throw new Error(`Groq request failed (${response.status})`)
  const data = await response.json()
  const explanation = data?.choices?.[0]?.message?.content?.trim()
  if (typeof explanation !== 'string' || explanation.length === 0) throw new Error('Groq returned no explanation')
  return explanation.slice(0, 600)
}

async function readRequestBody(request, maximumBytes = 8192) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (Buffer.byteLength(body) > maximumBytes) throw Object.assign(new Error('Request too large'), { statusCode: 413 })
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
    try {
      const body = await readRequestBody(request)
      if (typeof body.campaignName !== 'string' || !body.campaignName.trim() || body.campaignName.length > 100 || !Number.isInteger(body.reportViews) || body.reportViews < 3 || !Number.isInteger(body.daysSinceSend) || body.daysSinceSend < 0 || body.daysSinceSend > 7) {
        response.writeHead(400, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ ok: false, error: 'Invalid recommendation context' }))
        return
      }
      const explanation = await generateAnalyticsExplanation(body, options)
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify({ ok: true, explanation }))
    } catch (error) {
      const status = error?.statusCode ?? (process.env.GROQ_API_KEY || options.apiKey ? 502 : 503)
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify({ ok: false, error: status === 503 ? 'AI explanation is unavailable' : 'AI explanation could not be generated' }))
    }
  }
}
