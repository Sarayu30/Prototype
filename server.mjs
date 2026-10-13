import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGroqApiHandler, loadGroqEnv } from './server/groq-api.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(root, 'dist')
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }
await loadGroqEnv()
const groqHandler = createGroqApiHandler()

createServer(async (request, response) => {
  if (new URL(request.url ?? '/', 'http://localhost').pathname === '/api/analytics-explanation') {
    await groqHandler(request, response)
    return
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end()
    return
  }
  let pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
  let file = path.resolve(dist, `.${pathname}`)
  if (file !== dist && !file.startsWith(`${dist}${path.sep}`)) {
    response.writeHead(403).end()
    return
  }
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html')
    await stat(file)
  } catch {
    file = path.join(dist, 'index.html')
  }
  try {
    const content = await readFile(file)
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(request.method === 'HEAD' ? undefined : content)
  } catch {
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Build the app with npm run build first.')
  }
}).listen(Number(process.env.PORT ?? 4173), process.env.HOST ?? '127.0.0.1')
