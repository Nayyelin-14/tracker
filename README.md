# Energy Tracker — Live Demo

A self-contained, zero-infrastructure demo of the Energy Tracker product,
deployable to Vercel on the free tier.

**Live demo:** _add your Vercel URL here after the first deploy — e.g._
`https://energy-tracker-demo.vercel.app`

---

## What this is (and what it is not)

This repository is a **standalone frontend demo with a mocked API**.

The original Energy Tracker is a Java Spring Boot microservices system
(API gateway, user / device / usage / alert / insight / ingestion services,
backed by MySQL, Kafka and InfluxDB, orchestrated with Docker Compose).
That stack cannot be hosted for free, so it is **not** part of this project
and is **not** required to run this demo.

Instead, every endpoint the dashboard calls is served by a Next.js Route
Handler under `src/app/api/v1/`, and every reading is **simulated**:

- No database, no message broker, no time-series store.
- No API keys, no third-party LLM provider, no paid service of any kind.
- Nothing to install beyond Node.js. No Docker, no Java, no `docker compose up`.

| | Real backend | This demo |
|---|---|---|
| Repository | [`energy-tracker`](https://github.com/Nayyelin-14/energy-tracker) | this repo |
| Runtime | 6 Spring Boot services + gateway | one Next.js app |
| Storage | MySQL, InfluxDB | none — seed data is regenerated on every request |
| Messaging | Kafka | a synchronous function call |
| Hosting cost | a server | **$0** on Vercel Hobby |

If you want to see the actual microservices architecture, head to
**[`Nayyelin-14/energy-tracker`](https://github.com/Nayyelin-14/energy-tracker)**.
It is a separate, independent repository and is left untouched by this demo.

---

## Features to try

Everything below works in the live demo with no setup.

| Page | What you can do |
|---|---|
| **`/`** Overview | See 7 days of hourly consumption for 3 seeded devices, a per-device breakdown, the coverage meter, recent alerts, and the threshold status toggle. Switch the chart between hourly and daily buckets. |
| **`/devices`** | Register, rename, re-type, relocate and delete demo devices. Seeded devices can be edited; new ones get the next id in the 1001–1003 sequence. Validation errors are surfaced per field. |
| **`/simulation`** | Dispatch a batch of synthetic readings to any device. `normal` adds a small amount to the current hour; `high` pushes the hour past the 500 kWh threshold and raises a real alert you can then see on `/alerts`. Change the threshold first to watch edge-triggered alerting re-arm. |
| **`/alerts`** | Audit ledger of every threshold crossing, newest first, with the energy consumed against the limit that was in force at the time. |
| **`/insights`** | Pick a provider/model, then generate saving tips. The **stream** path delivers the text token-by-token over Server-Sent Events; the one-shot path returns the full JSON payload. An overview insight summarises the window. |

The default account is `demo@energytracker.dev` with alerting **armed** at
**500 kWh/bucket**, so the out-of-the-box flow is: open the overview, go to
Simulation, dispatch a `high` batch, then check Alerts.

---

## Run it locally

Requires Node.js 20+.

```bash
npm install
npm run dev
# → http://localhost:3000
```

That is the whole setup. There is no `.env` file to create and no environment
variables to configure.

Production build:

```bash
npm run build
npm run start
```

Lint:

```bash
npm run lint
```

---

## Deploy to Vercel

Free Hobby tier is more than enough — the app is a single serverless Next.js
project with no database, no queues and no external APIs.

1. Push this repository to GitHub.
2. On [vercel.com/new](https://vercel.com/new), import that repository.
3. Vercel auto-detects **Next.js**. Leave every setting at its default:
   - **Root Directory:** `/` (the repository root — this repo _is_ the app)
   - **Build Command:** `next build` (default)
   - **Output Directory:** `.next` (default)
   - **Environment Variables:** none
4. Click **Deploy**. The first build takes about a minute.
5. Copy the production URL and paste it into the **Live demo** line at the top
   of this README.

Redeploys happen automatically on every push to the default branch.

> **Cost:** nothing, and no credit card is required to create a Vercel
> account or deploy to the Hobby tier. There are no external services in the
> request path that could incur usage-based charges.

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                 # Overview dashboard
│   ├── devices/  alerts/  insights/  simulation/
│   └── api/v1/                  # ← the mocked API (Route Handlers)
│       ├── user/                #   demo user, profile + threshold updates
│       ├── device/              #   registry CRUD
│       ├── usage/               #   totals, hourly/daily series, coverage
│       ├── alert/               #   threshold-crossing ledger
│       ├── insight/             #   providers, saving tips, SSE stream
│       └── ingestion/           #   simulate a reading batch
├── components/                  # dashboard widgets, shell, design system
└── lib/
    ├── api.ts                   # single fetch client used by every page
    ├── types.ts                 # DTO contracts shared by UI + handlers
    └── demo/                    # ← the simulation engine
        ├── seed.ts              #   deterministic history generator
        ├── state.ts             #   per-visitor session cookie
        ├── store.ts             #   totals, series, coverage, alerts
        ├── insight.ts           #   rule-based "AI" text generation
        └── http.ts              #   RFC 7807 problem+json error helpers
```

The UI code in `src/app/(pages)` and `src/components` is the real product
surface. Only `src/lib/demo/**` and `src/app/api/v1/**` are simulation.

---

## How the simulation works

Two ideas keep it honest without any infrastructure:

**1. Deterministic seeding.** History is not stored anywhere. Every request
rebuilds the identical week of hourly readings from a pure function of
`(deviceId, timestamp)` — the same day/night curve the original Java
`DemoDataSeeder` writes into InfluxDB (quiet nights, an evening peak), plus a
hash-derived ±1 kWh jitter so the chart has texture. Any visitor, any
serverless instance, any cold start: same numbers.

**2. Session cookie.** Seed data is stateless, but a visitor can change things.
Mutations — threshold edits, device CRUD, dispatched spikes, the alerts those
spikes raise — are packed into a base64url cookie (`et_demo`, ~3.6 KB budget,
30-day lifetime) that rides on the request. That is what makes the demo work on
stateless serverless functions, and why nothing one visitor does is visible to
another.

Alerting is **edge-triggered**, exactly like the real system: a notification
fires only on a below→above crossing, stays quiet while the aggregate remains
high, and re-arms when it drops back under or the threshold changes.

---

## API surface

Every path below is implemented in this repo. Nothing proxies out.

| Method | Path |
|---|---|
| `GET` | `/api/v1/user/demo` |
| `GET` `PUT` | `/api/v1/user/:id` |
| `GET` | `/api/v1/device/user/:userId` |
| `POST` | `/api/v1/device/create` |
| `GET` `PUT` `DELETE` | `/api/v1/device/:id` |
| `GET` | `/api/v1/usage/:userId?days=` |
| `GET` | `/api/v1/usage/:userId/series?days=&interval=hour\|day` |
| `GET` | `/api/v1/usage/:userId/coverage` |
| `GET` | `/api/v1/alert/user/:userId?limit=` |
| `GET` | `/api/v1/insight/providers` |
| `GET` | `/api/v1/insight/saving-tips/:userId` |
| `GET` | `/api/v1/insight/saving-tips/stream/:userId` *(SSE)* |
| `GET` | `/api/v1/insight/overview/:userId` |
| `POST` | `/api/v1/ingestion/simulate/device/:deviceId?mode=normal\|high` |

Errors use `application/problem+json` (RFC 7807) with a `detail` field, and
insight generation is rate-limited so the `429` + `Retry-After` path is
reachable.

---

## Tech

Next.js 16 (App Router, Route Handlers, Server-Sent Events) · React 19 ·
TypeScript · Tailwind CSS 4 · Recharts · Framer Motion
