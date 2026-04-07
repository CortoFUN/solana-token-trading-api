# API Key Web Tool Example

Standalone local web console for Corto.Fun lightning buys and sells.

## What this example does

- Starts a local Node relay with `npm start`.
- Serves a browser UI from the same process.
- Keeps `CORTO_API_KEY` on the server only.
- Exposes only local endpoints to the browser:
	- `GET /api/runtime`
	- `POST /api/trade`
	- `GET /api/status/:signature`

## Quick start

```bash
cd examples/web-client
npm install
copy .env.example .env
npm start
```

Open `http://localhost:3301`.

## Environment

- `WEB_PORT=3301`
- `CORTO_BASE_URL=https://corto.fun`
- `CORTO_API_KEY=PUT_YOUR_API_KEY_HERE`
- `CORTO_DEFAULT_POOL=auto`

## Behavior

- The server starts even if `.env` is incomplete.
- If `CORTO_API_KEY` is missing, the UI comes up and clearly shows that trading is disabled until the key is set.
- Trades are forwarded to `POST /api/v1/lightning/trade` with `ackMode=confirmed` and `maxRouteMs=1200`.
- The relay sends `CORTO_API_KEY` only in the `X-API-Key` header.
- `GET /api/runtime` includes the upstream Lightning capabilities snapshot, so the local UI and external tools can bootstrap from the same contract as production.
- The last returned signature can be re-checked through the built-in status button.
- Optional `memo` is forwarded upstream and follows the same user-first memo policy as the public API.
- `GET /api/status/:signature` can read back the final on-chain memo text after runtime composition.
- If a trade hits `TX_SIZE_EXCEEDED`, the upstream API now returns safe size details describing memo/Jito degradation instead of a blind overflow error.

## Why this example is production-relevant

- It mirrors the header-only API key model used by the real Lightning API.
- It keeps the API key off the browser while still exposing a usable buy/sell/status surface.
- It stays aligned with the live-validated memo contract instead of inventing custom client-side memo behavior.

## Files

- `server.js` — local relay and runtime endpoints.
- `public/index.html` — page shell.
- `public/app.js` — browser logic.
- `public/styles.css` — dark futuristic styling without gradient-heavy clutter.