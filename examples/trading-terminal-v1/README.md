# Trading Terminal v1 Example

Standalone local relay and browser UI for Corto launchpad trading, live stream monitoring, token creation, and claim flows.

## What this example does

- Starts a local Node relay with `npm start`.
- Serves a browser UI from the same process.
- Uses the real Corto API and real Corto public stream instead of mocked demo data.
- Ships two real pages in one example:
	- `FluxBoard` for compact launchpad monitoring and buy or sell actions.
	- `StarForge` for token create plus cashback or creator-fee claim flows.
- Exposes only local endpoints to the browser:
	- `GET /api/runtime`
	- `POST /api/lightning/trade`
	- `POST /api/local/build-trade`
	- `GET /api/status/:signature`
	- `POST /api/token-builder/create`
	- `POST /api/token-builder/claim`
	- `GET /api/stream`

## Quick start

```bash
cd examples/trading-terminal-v1
npm install
copy .env.example .env
npm start
```

Open `http://localhost:3305`.

## Environment

- `WEB_PORT=3305`
- `CORTO_BASE_URL=https://corto.fun`
- `CORTO_WS_URL=wss://corto.fun/data-stream`
- `CORTO_DEFAULT_POOL=auto`

## Behavior

- The server starts even if `.env` is incomplete.
- API key entry happens in the UI when Lightning, create, or claim actions are needed.
- `FluxBoard` keeps a live cache of creates, near-filled curves, and migrated tokens from the public data stream.
- Launchpad filters, desk mode, API key, and local wallet preference are persisted locally for a smoother reload experience.
- Lightning mode forwards trades through the real Corto API using the key pasted into the page.
- Local mode builds unsigned transactions for Phantom signing instead of moving the private key into the relay flow.
- `StarForge` forwards create and claim actions through the real Token Builder surfaces.
- `GET /api/runtime` exposes the upstream capabilities snapshots so the UI stays aligned with production contracts.

## Files

- `server.js` — local relay and runtime endpoints.
- `public/index.html` — FluxBoard page shell.
- `public/launch.html` — StarForge page shell.
- `public/app.js` — FluxBoard browser logic.
- `public/launch.js` — StarForge browser logic.
- `public/styles.css` — shared local styling for both pages.