import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { CarCertificate } from '@immatis/core/types'
import { getFiscal, hasReception } from '@immatis/core/rules'
import { ocr } from './ocr.js'

const app = new Hono()

type ScanMimeType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

type certificateScan = {
  file: string | Blob;
  mimeType: ScanMimeType;
};

type upStream = {
  type: "image",
  uri: string,
  mime_type: string
}


let scans: certificateScan[] = [{ file: "./src/kettentkard.jpeg", mimeType: "image/jpeg" }, { file: "./src/kettentkard2.jpeg", mimeType: "image/jpeg" }, { file: "./src/kettentkard3.jpeg", mimeType: "image/jpeg" }]


let oscResult = await ocr(scans)

console.log(getFiscal(oscResult))
console.log(hasReception(oscResult))


app.get('/', (c) => {
  return c.text('Hello Hono!')
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
