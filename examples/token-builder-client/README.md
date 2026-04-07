# Token Builder Client Example

Standalone local relay and browser UI for Corto token creation and claim flows.

## What this example does

- Starts a local Node relay with `npm start`.
- Serves a browser UI from the same process.
- Keeps `CORTO_API_KEY` on the server only.
- Proxies these upstream endpoints:
  - `GET /api/v1/token-builder/capabilities`
  - `POST /api/v1/token-builder/create`
  - `POST /api/v1/token-builder/claim-cashback`

## Quick start

```bash
cd examples/token-builder-client
npm install
copy .env.example .env
npm start
```

Open `http://localhost:3304`.

## Environment

- `WEB_PORT=3304`
- `CORTO_BASE_URL=https://corto.fun`
- `CORTO_API_KEY=PUT_YOUR_API_KEY_HERE`

## Behavior

- The server starts even if `.env` is incomplete.
- If `CORTO_API_KEY` is missing, create and claim stay disabled but the UI still loads.
- Image upload is handled in memory through multer and immediately forwarded upstream.
- The relay never stores image files on disk.
- letsbonk claim in this example is LaunchLab creator fee claim behind the shared builder endpoint.
- Create flow also supports optional dev wallet buy through `devBuyEnabled` and `devBuySol` in the same multipart request.

## Files

- `server.js` — local relay and runtime endpoints.
- `public/index.html` — page shell.
- `public/app.js` — browser logic.
- `public/styles.css` — compact local styling for the example UI.