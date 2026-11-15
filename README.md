# ASTRA — Adaptive Spaceflight Tracking & Risk Assessment

ASTRA is a read-only decision-support **prototype** for astronaut health and mission risk monitoring. It is **not a validated clinical system** and cannot diagnose, prescribe countermeasures, or control spacecraft systems.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, React Router, plain CSS with CSS variables (no UI component library)
- **Backend**: Node.js, Express, TypeScript, Zod validation, SQLite (`better-sqlite3`, stored automatically at `data/astra.db`)

## Setup & Running

you need to download node.js first

1.get clone:
   ```bash
   git clone https://github.com/ebrahimrabie/ASTRA.git
   ```

2. open astra:
   ```bash
   cd ASTRA
   ```

3. Install dependencies:
   ```bash
   npm install
   ```


4. Run in development (starts Express API + Vite frontend middleware on port 3000):
   ```bash
   npm run dev
   ```
will open front end on http://localhost:3000
ctrl + c and y to close 

5. Run backend tests:
   ```bash
   npm test
   ```

   6. Type-check:
   ```bash
   npm run lint
   ```

7. Build for production & run:
   ```bash
   set NODE_ENV=production&& npm start
   ```




## Demo User Scoping

ASTRA uses no real authentication service in this prototype. Clicking **Enter Demo Mode** generates a random UUID once, stores it in `localStorage` under `astra_demo_user_id`, and sends it in the `X-Demo-User` request header. All backend records are strictly scoped to that UUID. Requests to protected API endpoints without a valid UUID receive `401`.

## REST API Documentation

All error responses return `{ "error": "message" }`. Timestamps are UTC epoch milliseconds. Rate limit is 100 requests/minute per IP.

- `GET /api/health-check` → `{ "ok": true }`
- `GET /api/tasks` → `{ "tasks": [...] }` (newest first)
- `POST /api/tasks` body `{ "name": string (1-80), "due": "HH:MM" }` → `201 { "task": {...} }` and appends `"Created: <name>"` to history
- `PATCH /api/tasks/:id/complete` → `200 { "task": {...} }` (only from `PENDING`, else `409`; `404` if missing or owned by another user) and appends `"Completed: <name>"` to history
- `PATCH /api/tasks/:id/defer` body `{ "reason": string (1-300) }` → `200 { "task": {...} }` (only from `PENDING`, else `409`; `404` if missing or owned by another user) and appends `"Deferred: <name> (reason: <reason>)"` to history
- `GET /api/history?limit=100` → `{ "history": [...] }` (newest first)
- `GET /api/health-indicators` → `{ "indicators": [...] }` (seeds 6 simulated indicators with `recordedAt: null` and `source: null` on first request for a user)
- `GET /api/risks` → `{ "risks": [...] }`
- `GET /api/risks/env` → `{ "samples", "latest", "sampleMean", "coverageMinutes", "verifiedHourAverage", "status" }` (seeds 4 simulated CO2 samples on first request; `verifiedHourAverage` is `null` unless `coverageMinutes >= 60`)
- `GET /api/sleep` → `{ "records": [...] }` (5 supplied sleep records, Day 1–5)
