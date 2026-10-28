import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { bodyLimit } from 'hono/body-limit'
import type { Bilan } from '@immatis/core/types'
import { getFiscal, getReception } from '@immatis/core/rules'
import { ocr } from './ocr.js'

const LOCAL_ORIGINS = ['http://localhost:3000']

// 3 volets, 10 Mo chacun.
const MAX_BODY = 3 * 10 * 1024 * 1024

function configuredOrigins(): string[] {
  return (process.env.WEB_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

// Production et previews du projet web `immatis`. `immatis-api` est exclu.
function isImmatisWeb(origin: string): boolean {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  return /^immatis(-(?!api(?:-|$))[a-z0-9-]+)?\.vercel\.app$/.test(url.hostname)
}

function allowedOrigin(origin: string): string | null {
  if (!origin) return null
  if (LOCAL_ORIGINS.includes(origin) || configuredOrigins().includes(origin) || isImmatisWeb(origin)) {
    return origin
  }
  return null
}

const app = new Hono()

app.get('/', (c) => c.json({ ok: true }))

app.use('/scans', cors({ origin: (origin) => allowedOrigin(origin) }))

type ScanMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'

type scans = {
  file: string | Blob
  mimeType: ScanMimeType
}

let id = 0

app.post(
  '/scans',
  bodyLimit({
    maxSize: MAX_BODY,
    onError: (c) => c.text('Fichiers trop volumineux.', 413),
  }),
  async (c) => {
    const body = await c.req.parseBody({ all: true })
    // champ `file` répété : 1 à 3 volets
    const files = [body['file']].flat().filter((f) => f instanceof File).slice(0, 3)
    if (!files.length) return c.text('no file :(', 400)

    return streamSSE(c, async (stream) => {
      const scans: scans[] = files.map((f) => ({ file: f, mimeType: f.type as ScanMimeType }))

      // le corps est déjà lu par parseBody : l'envoi du navigateur est fini
      await stream.writeSSE({ event: 'upload', data: 'done', id: String(id++) })

      const certificate = await ocr(scans)
      await stream.writeSSE({ event: 'certificate', data: JSON.stringify(certificate), id: String(id++) })

      const bilan: Bilan = { reception: getReception(certificate), fiscal: getFiscal(certificate) }
      await stream.writeSSE({ event: 'bilan', data: JSON.stringify(bilan), id: String(id++) })
    }, async (err, stream) => {
      await stream.writeSSE({ event: 'error', data: err.message, id: String(id++) })
    })
  },
)

export default app
