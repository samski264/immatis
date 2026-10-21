import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { bodyLimit } from 'hono/body-limit'
import type { CarCertificate, Bilan } from '@immatis/core/types'
import { getFiscal, getReception } from '@immatis/core/rules'
import { ocr } from './ocr.js'

const app = new Hono()
app.use('/scans', cors({ origin: 'http://localhost:3000' }))

type ScanMimeType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

type scans = {
  file: string | Blob;
  mimeType: ScanMimeType;
};

let id = 0

app.post('/scans', bodyLimit({ maxSize: 3 * 10 * 1024 * 1024, onError: (c) => { return c.text('overflow :(', 413) }, }),
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

      const bilan: Bilan = { reception: getReception(certificate), fiscal: getFiscal(certificate)}
      await stream.writeSSE({ event: 'bilan', data: JSON.stringify(bilan), id: String(id++) })
    }, async (err, stream) => {
      await stream.writeSSE({ event: 'error', data: err.message, id: String(id++) })
    })
  }
)

serve({
  fetch: app.fetch,
  port: 3001 // 3000 est pris par Next
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
