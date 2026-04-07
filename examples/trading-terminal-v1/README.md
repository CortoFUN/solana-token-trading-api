# Trading Terminal v1 Example

Standalone local relay and browser UI for Corto launchpad trading, live stream monitoring, token creation, and claim flows.

## What this example does

- Starts a local Node relay with `npm start`.
- Serves a browser UI from the same process.
- Uses the real Corto API and real Corto public stream instead of mocked demo data.
- Ships three real pages in one example:
	- `FluxBoard` for compact launchpad monitoring and buy or sell actions.
	- `StarForge` for token create plus cashback or creator-fee claim flows.
	- `Access` for personal wallet keys, agent wallet generation, and simple agent settings.
- Exposes only local endpoints to the browser:
	- `GET /api/runtime`
	- `POST /api/lightning/trade`
	- `POST /api/local/build-trade`
	- `GET /api/status/:signature`
	- `POST /api/wallet/generate`
	- `POST /api/verify`
	- `GET /api/agent-wallet/capabilities`
	- `POST /api/agent-wallet/generate`
	- `GET /api/agent-wallet/profile`
	- `GET /api/agent-wallet/balances`
	- `GET /api/agent-wallet/stats`
	- `GET /api/agent-wallet/history`
	- `POST /api/agent-wallet/settings`
	- `POST /api/token-builder/create`
	- `POST /api/token-builder/claim`
	- `GET /api/stream`
	- `GET /api/stream/trades/:mint`

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
- `FluxBoard` also loads the last 50 live trades for the selected token only while the trade modal stays open.
- Launchpad filters, desk mode, API key, and local wallet preference are persisted locally for a smoother reload experience.
- Lightning mode forwards trades through the real Corto API using the key pasted into the page.
- Local mode builds unsigned transactions for Phantom signing instead of moving the private key into the relay flow.
- `StarForge` forwards create and claim actions through the real Token Builder surfaces.
- `Access` keeps personal wallet and agent wallet tasks in one place without exposing raw backend jargon.
- `GET /api/runtime` exposes the upstream capabilities snapshots so the UI stays aligned with production contracts.

## Files

- `server.js` — local relay and runtime endpoints.
- `public/index.html` — FluxBoard page shell.
- `public/launch.html` — StarForge page shell.
- `public/access.html` — Access page shell.
- `public/js/fluxboard.js` — FluxBoard browser logic.
- `public/js/starforge.js` — StarForge browser logic.
- `public/js/access.js` — Access page browser logic.
- `public/css/fluxboard.css` — FluxBoard styling.
- `public/css/starforge.css` — StarForge styling.
- `public/css/access.css` — Access page styling.