import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error server-only JavaScript module (never bundled into the client)
import { createGroqApiHandler, loadGroqEnv } from './server/groq-api.mjs'

const groqHandler = createGroqApiHandler()
await loadGroqEnv()

export default defineConfig({
  plugins: [react(), {
    name: 'cheerio-groq-api',
    configureServer(server) {
      server.middlewares.use(groqHandler)
    },
  }],
})
