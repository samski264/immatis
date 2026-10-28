import { serve } from '@hono/node-server'
import app from './app.js'

const port = Number(process.env.PORT) || 3001

serve({
  fetch: app.fetch,
  port,
  ...(process.env.HOST ? { hostname: process.env.HOST } : {}),
}, (info) => {
  console.log(`Server is running on http://${info.address}:${info.port}`)
})
