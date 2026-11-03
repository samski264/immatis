# immatis

Simulates the French registration process for an imported vehicle from scans of its foreign
registration certificate. Online: https://www.immatis.com

Input: 1 to 3 pages of the certificate (photo or PDF). Output: type-approval path, VAT,
fiscal horsepower, and the CO₂/weight tax — each with the field that was read and the rule
that was applied. No account, no form.

## Pipeline

```
scans → extraction (Gemini, output constrained by the Zod schema) → certificate → rules → assessment
```

- **Certificate**: 19 EU-harmonized codes (Directive 1999/37/EC), `null` if missing,
  unreadable, or blank. The model reads the codes, never the labels: the country does not
  matter.
- **Rules**: pure functions in `packages/core/rules.ts`. Rate tables as versioned JSON
  (`packages/core/json`), each with its source and verification date.
- **Assessment**: `{ reception, fiscal: { TVA, malus, chevaux } }`. A missing value yields
  `null`, never an estimate.

## Rules

| Output | Rule |
| --- | --- |
| **Path** | Three readings, all required: `K` filled (CE type-approval on the certificate), `J` equal to M1 or N1, and the 15 codes (A, B, C.1, D.1, D.2, D.3, E, F.1, G, H, I, P.1, P.2, P.3, S.1) filled → **AVDT**. One miss → **RTI**. V.7 and V.9 are ignored. |
| **VAT** | Gap between `B` and today, in calendar months. ≤ 6 → due. |
| **Fiscal horsepower** | `CV = round(1.8·(P.2/100)² + 3.87·(P.2/100) + 1.34)`. Price = CV × €53.50 (average of 2026 regional rates). |
| **Malus** | Exempt if ≥ 181 months or `B` ≤ 2015-01-01. Otherwise CO₂ malus (`V.7`, rate in force on date `B`) + weight malus (`G`, rate ≥ 2022), age discount on the sum, rounded to the euro. V.7 and G both missing → `null`; only one missing → counts as 0. |

If `B` is missing: neither VAT nor malus. Only fiscal horsepower is returned if `P.2` was read.

25 Vitest tests on type approval and taxation (`packages/core/rules.test.ts`).

## API — `apps/api` (Hono)

- `GET /` → `{ ok: true }`
- `POST /scans` — multipart, repeated `file` field (1 to 3 files, jpeg/png/webp/pdf, 10 MB
  each). SSE response: `upload` → `certificate` → `bilan`, or `error`.
- CORS: `localhost:3000`, origins from `WEB_ORIGIN`, the project's Vercel previews.

## Site — `apps/web` (Next.js)

- `/`: hero, page upload, three animated steps, landscape strip.
- `/result`: assessment read from `sessionStorage`, one fixed explanation per verdict
  (`result/conform.js`), print export.
- `/example`: synthetic certificate for testing without a document.
- `/homologation`, `/taxes`, `/papiers`: Markdown articles from `public/articles`, rendered
  statically by silo (`[silo]/[[...rest]]`).

### Canvas

A single WebGL2 particle system (`components/lib/particles.js`,
`design/shaders/particles.glsl`): a grid of dithered ASCII glyphs, a pointer that enlarges
particles via transform feedback, no displacement.

- **LandscapeStrip**: landscapes sampled as particles, looping scroll, a winding road
  (Catmull-Rom spline stored as a texture) followed by an arrow.
- **ParticleScene**: the step scenes (`lib/stepScenes.js`) are drawn in grayscale on a 2D
  canvas at grid resolution, sent as a texture, rendered in ink-on-background monochrome.
  Rendering is cut off when off screen.
- **Flight** (`lib/routeFlight.js`): the landscape takes off on upload, travels during the
  scan (phases `upload` then `analyse`, timed to the SSE events), lands once `certificate`
  and `bilan` have arrived, then `/result` opens. `prefers-reduced-motion` disables the
  flight.

## Structure

npm workspaces monorepo.

```
packages/core   types, Zod schema, rules, JSON rate tables, tests
apps/api        Hono — POST /scans, Gemini extraction
apps/web        Next.js — site, result, articles, canvas
design/         .pen mockup, shader
```

## Development

```bash
npm install
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:3000
npm test
```

`apps/api/.env`: `GEMINI_API_KEY`, `WEB_ORIGIN` (comma-separated origins).
`apps/web/.env`: `NEXT_PUBLIC_API_URL`, read at build time.

## Production

Site on Vercel (`apps/web`), API on a server behind Caddy (`api.immatis.com`,
PM2). Procedure in `DEPLOY.md`, kept out of the repository.

## Out of scope

Deregistration, DREAL matching, chain of ownership, roadworthiness test, history, FFVE,
document generation.
