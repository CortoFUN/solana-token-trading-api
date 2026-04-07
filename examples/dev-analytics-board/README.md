# Developer Analytics Board Example

Standalone local dashboard for Corto.Fun developer analytics.

## What this example does

- Starts a local Node relay with `npm start`.
- Serves a browser dashboard from the same process.
- Keeps `CORTO_API_KEY` on the server only.
- Resolves the partner wallet from `CORTO_API_KEY` via the upstream verify endpoint.
- Queries `POST /api/v1/dev/analytics/trades` through local relay endpoints.
- Renders summary cards and a sortable per-user table.

## Quick start

```bash
cd examples/dev-analytics-board
npm install
copy .env.example .env
npm start
```

Open `http://localhost:3303`.

## Environment

- `CORTO_BASE_URL=https://corto.fun`
- `CORTO_API_KEY=PUT_YOUR_API_KEY_HERE`
- `DEV_ANALYTICS_PORT=3303`

Use the API key generated for the same wallet that you pass as `partnerAddress` in lightning trades. The relay derives that wallet automatically and locks analytics queries to that partner scope.

## Local endpoints

- `GET /api/runtime`
- `POST /api/analytics`

## Behavior

- The browser never sends the API key to the public API directly.
- The relay uses the API key only via the `X-API-Key` header for both verify and analytics upstream calls.
- The local relay forwards analytics queries to `POST /api/v1/dev/analytics/trades`.
- Analytics access works only when `partnerAddress` matches the public key restored from the configured API key.
- `projectId` is treated only as an extra filter inside that verified partner scope.
- The UI sorts rows client-side by volume, API fee, partner fee, and trade counters.
- Frame syntax follows the upstream contract: `1..24h` or `1..30d`.

## Files

- `server.js` — local relay and runtime endpoints.
- `public/index.html` — analytics board UI shell.
- `public/app.js` — browser logic and sortable table rendering.
- `public/styles.css` — standalone styling for the board.