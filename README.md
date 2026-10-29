# immatis

Simule l'instruction française d'un véhicule importé à partir des scans de sa carte grise
étrangère. En ligne : https://www.immatis.com

Entrée : 1 à 3 volets du certificat (photo ou PDF). Sortie : voie d'homologation, TVA,
chevaux fiscaux, malus — chacun avec le champ lu et la règle appliquée. Pas de compte, pas
de formulaire.

## Pipeline

```
scans → extraction (Gemini, sortie contrainte par le schéma Zod) → certificat → règles → bilan
```

- **Certificat** : 19 codes harmonisés UE (directive 1999/37/CE), `null` si absent, illisible
  ou vide. Le modèle lit les codes, jamais les libellés : le pays n'intervient pas.
- **Règles** : fonctions pures dans `packages/core/rules.ts`. Barèmes en JSON versionné
  (`packages/core/json`), chacun avec sa source et sa date de vérification.
- **Bilan** : `{ reception, fiscal: { TVA, malus, chevaux } }`. Une donnée manquante donne
  `null`, jamais une estimation.

## Règles

| Sortie | Règle |
| --- | --- |
| **Voie** | `K` renseigné → réception déjà faite, pas de voie. Sinon les 15 codes exigés (A, B, C.1, D.1, D.2, D.3, E, F.1, G, H, I, P.1, P.2, P.3, S.1) tous remplis → **AVDT**, un seul vide → **RTI**. J, V.7, V.9 ignorés. |
| **TVA** | Écart entre `B` et aujourd'hui en mois calendaires. ≤ 6 → due. |
| **Chevaux fiscaux** | `CV = arrondi(1,8·(P.2/100)² + 3,87·(P.2/100) + 1,34)`. Prix = CV × 53,50 € (moyenne des tarifs régionaux 2026). |
| **Malus** | Exonéré si ≥ 181 mois ou `B` ≤ 01/01/2015. Sinon malus CO₂ (`V.7`, barème en vigueur à la date `B`) + malus masse (`G`, barème ≥ 2022), décote d'ancienneté sur la somme, arrondi à l'euro. V.7 et G absents → `null` ; un seul absent → compte pour 0. |

`B` absent : ni TVA ni malus. Seuls les CV sortent si `P.2` est lu.

25 tests Vitest sur réception et fiscalité (`packages/core/rules.test.ts`).

## API — `apps/api` (Hono)

- `GET /` → `{ ok: true }`
- `POST /scans` — multipart, champ `file` répété (1 à 3 fichiers, jpeg/png/webp/pdf, 10 Mo
  chacun). Réponse en SSE : `upload` → `certificate` → `bilan`, ou `error`.
- CORS : `localhost:3000`, les origines de `WEB_ORIGIN`, les previews Vercel du projet.

## Site — `apps/web` (Next.js)

- `/` : hero, dépôt des volets, trois étapes animées, bande de paysages.
- `/result` : bilan lu depuis `sessionStorage`, une explication fixe par verdict
  (`result/conform.js`), export par impression.
- `/example` : certificat synthétique pour tester sans document.
- `/homologation`, `/taxes`, `/papiers` : articles Markdown de `public/articles`, rendus
  statiquement par silo (`[silo]/[[...rest]]`).

### Canvas

Un seul système de particules WebGL2 (`components/lib/particles.js`,
`design/shaders/particles.glsl`) : grille de glyphes ASCII tramés, pointeur qui grossit les
particules via transform feedback, pas de déplacement.

- **LandscapeStrip** : paysages échantillonnés en particules, défilement en boucle, route
  sinueuse (spline Catmull-Rom en texture) suivie d'une flèche.
- **ParticleScene** : les scènes des étapes (`lib/stepScenes.js`) sont dessinées en niveaux
  de gris dans un canvas 2D à la résolution de la grille, envoyées en texture, rendues en
  monochrome encre → fond. Rendu coupé hors écran.
- **Vol** (`lib/routeFlight.js`) : le paysage décolle au dépôt, voyage pendant le scan
  (phases `upload` puis `analyse`, calées sur les événements SSE), se pose quand
  `certificate` et `bilan` sont arrivés, puis `/result` s'ouvre. `prefers-reduced-motion`
  coupe le vol.

## Structure

Monorepo npm workspaces.

```
packages/core   types, schéma Zod, règles, barèmes JSON, tests
apps/api        Hono — POST /scans, extraction Gemini
apps/web        Next.js — site, résultat, articles, canvas
design/         maquette .pen, shader
```

## Développement

```bash
npm install
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:3000
npm test
```

`apps/api/.env` : `GEMINI_API_KEY`, `WEB_ORIGIN` (origines séparées par des virgules).
`apps/web/.env` : `NEXT_PUBLIC_API_URL`, lu au build.

## Production

Site sur Vercel (`apps/web`), API sur un serveur derrière Caddy (`api.immatis.com`,
PM2). Procédure dans `DEPLOY.md`, hors dépôt.

## Hors périmètre

Radiation, concordance DREAL, chaîne de détention, contrôle technique, historique, FFVE,
génération de pièces.
