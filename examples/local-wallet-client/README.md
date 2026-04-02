# Local Wallet Tool Example

Standalone local Phantom tool for unsigned Corto.Fun transactions.

## What this example does

- Starts a local Node server with `npm start`.
- Serves a browser UI from the same process.
- Builds unsigned transactions through a local relay endpoint.
- Sends signing and broadcasting into Phantom only.

## Quick start

```bash
cd examples/local-wallet-client
npm install
copy .env.example .env
npm start
```

Open `http://localhost:3302` in a browser with Phantom installed.

## Environment

- `LOCAL_WALLET_PORT=3302`
- `CORTO_BASE_URL=https://corto.fun`
- `CORTO_DEFAULT_POOL=auto`

## Local endpoints

- `GET /api/runtime`
- `POST /api/build-trade`
- `GET /api/status/:signature`

## Behavior

- The browser never calls the public API directly.
- The local relay requests `POST /api/v1/local/trade` and returns the unsigned base64 transaction.
- Phantom signs and broadcasts the built transaction in-browser.
- `GET /api/runtime` includes the upstream Local capabilities snapshot, so the example stays aligned with the real unsigned-build contract.
- After broadcast, the same page can re-check transaction status.
- Optional `memo` is forwarded upstream and follows the same user-first memo policy as the public API.
- `GET /api/status/:signature` can read back the final on-chain memo text if the built transaction contained a memo instruction.
- If the built transaction exceeds the size limit, the upstream API now returns safe size details describing which memo fallback path was attempted.

## Why this example is production-relevant

- It keeps signing in Phantom and never moves the routine signing step into the relay.
- It uses the same Local capabilities and tx-status surfaces as the public API.
- It matches the live-validated memo policy used by the real service.

## Files

- `server.js` — local relay and runtime endpoints.
- `public/index.html` — page shell.
- `public/app.js` — Phantom and UI flow.
- `public/styles.css` — dark futuristic styling without visual noise.