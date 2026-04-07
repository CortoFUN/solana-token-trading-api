# Human Starter Scripts

Copy-paste Node scripts for ordinary Corto wallet flows through `X-API-Key`.

This folder is for teams that want to demo or integrate the normal wallet path without agent-wallet policy controls.

No extra package is required. These scripts use Node 18+ built-in `fetch`, `FormData`, and `Blob`.

## Included scripts

- `00-generate-wallet.mjs` creates a regular wallet bundle with public key, private key, and API key.
- `01-verify-api-key.mjs` verifies an ordinary wallet API key through the public header-only verify route.
- `02-lightning-buy.mjs` submits a Lightning buy through `X-API-Key`.
- `03-lightning-sell.mjs` submits a Lightning sell through `X-API-Key`.
- `04-ordinary-swap.mjs` executes a dedicated exact-in swap through `X-API-Key`.
- `05-token-create.mjs` submits token-builder create with multipart image upload.
- `06-token-claim.mjs` submits token-builder claim.
- `07-human-full-cycle.mjs` runs swap in, swap out, and optional verify/status checks on the ordinary wallet path.
- `08-openai-claude-user-wallet-example.mjs` exports ready-to-paste helper functions for ordinary wallet runtimes.
- `09-human-data-stream.mjs` opens the public WebSocket data stream and prints parsed service and event envelopes.

## Quick start

```bash
cd examples/human-starter-scripts
node 00-generate-wallet.mjs
```

Env template:

```bash
copy .env.example .env
```

Then export the API key you want to use:

```bash
set CORTO_BASE_URL=http://127.0.0.1:3000
set CORTO_API_KEY=PUT_API_KEY_HERE
```

Verify the key:

```bash
node 01-verify-api-key.mjs
```

Run Lightning buy and sell:

```bash
set CORTO_LIGHTNING_MINT=So11111111111111111111111111111111111111112
set CORTO_LIGHTNING_BUY_AMOUNT=0.01
node 02-lightning-buy.mjs

set CORTO_LIGHTNING_SELL_AMOUNT=10%
node 03-lightning-sell.mjs
```

Run an exact-in dedicated swap:

```bash
set CORTO_SWAP_INPUT_MINT=So11111111111111111111111111111111111111112
set CORTO_SWAP_OUTPUT_MINT=Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
set CORTO_SWAP_AMOUNT=0.005
node 04-ordinary-swap.mjs
```

Run token create and claim:

```bash
set CORTO_TOKEN_IMAGE_PATH=./token-image.png
set CORTO_TOKEN_NAME=Corto Nova
set CORTO_TOKEN_SYMBOL=NOVA
set CORTO_TOKEN_DESCRIPTION=Example launch from human starter scripts
node 05-token-create.mjs

set CORTO_CLAIM_PLATFORM=letsbonk
node 06-token-claim.mjs
```

Run the full-cycle ordinary-wallet example:

```bash
set CORTO_SWAP_IN_INPUT_MINT=So11111111111111111111111111111111111111112
set CORTO_SWAP_IN_OUTPUT_MINT=Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
set CORTO_SWAP_IN_AMOUNT=0.005
set CORTO_SWAP_OUT_AMOUNT=0.39
node 07-human-full-cycle.mjs
```

Watch the public Data Stream from a human/operator process:

```bash
set CORTO_STREAM_MODE=trades
set CORTO_STREAM_MAX_EVENTS=20
node 09-human-data-stream.mjs
```

## Environment variables

- `CORTO_BASE_URL` default: `https://corto.fun`
- `CORTO_API_KEY` required for verify, Lightning, swap, token create, and token claim
- `CORTO_SWAP_INPUT_MINT` required for swap
- `CORTO_SWAP_OUTPUT_MINT` required for swap
- `CORTO_SWAP_AMOUNT` required for swap
- `CORTO_SWAP_SLIPPAGE` optional, default `10`
- `CORTO_SWAP_POOL` optional, default `jupiter`
- `CORTO_SWAP_PRIORITY_FEE_SOL` optional, default `0.0003`
- `CORTO_SWAP_MAX_ROUTE_MS` optional, default `8000`
- `CORTO_SWAP_MEMO` optional, default `human starter script swap`
- `CORTO_LIGHTNING_MINT` required for Lightning buy and sell
- `CORTO_LIGHTNING_BUY_AMOUNT` required for Lightning buy
- `CORTO_LIGHTNING_SELL_AMOUNT` required for Lightning sell, for example `10%`
- `CORTO_LIGHTNING_POOL` optional, default `auto`
- `CORTO_LIGHTNING_SLIPPAGE` optional, default `5`
- `CORTO_LIGHTNING_PRIORITY_FEE_SOL` optional
- `CORTO_LIGHTNING_JITO_TIP_SOL` optional
- `CORTO_TOKEN_PLATFORM` optional, default `pump`
- `CORTO_TOKEN_NAME` required for create
- `CORTO_TOKEN_SYMBOL` required for create
- `CORTO_TOKEN_DESCRIPTION` required for create
- `CORTO_TOKEN_IMAGE_PATH` required for create
- `CORTO_TOKEN_WEBSITE` optional
- `CORTO_TOKEN_TWITTER` optional
- `CORTO_TOKEN_TELEGRAM` optional
- `CORTO_TOKEN_MIGRATE_TYPE` optional, used for letsbonk
- `CORTO_TOKEN_CASHBACK_ENABLED` optional, default `true`
- `CORTO_TOKEN_DEV_BUY_ENABLED` optional, default `false`
- `CORTO_TOKEN_DEV_BUY_SOL` optional
- `CORTO_CLAIM_PLATFORM` optional, default `pump`
- `CORTO_SWAP_IN_INPUT_MINT`, `CORTO_SWAP_IN_OUTPUT_MINT`, `CORTO_SWAP_IN_AMOUNT` for full-cycle step 1
- `CORTO_SWAP_OUT_INPUT_MINT`, `CORTO_SWAP_OUT_OUTPUT_MINT`, `CORTO_SWAP_OUT_AMOUNT` for full-cycle step 2
- `CORTO_VERIFY_AFTER_SWAP` optional, default `true`
- `CORTO_STREAM_WS_URL` optional, default `wss://corto.fun/data-stream`
- `CORTO_STREAM_MODE` optional quick mode: `all`, `mints`, `trades`, `migrations`, `pools`
- `CORTO_STREAM_EVENTS` optional comma-separated advanced events filter
- `CORTO_STREAM_POOLS` optional comma-separated advanced pools filter
- `CORTO_STREAM_CREATE_DETAIL` optional create detail level: `min`, `mid`, `full`
- `CORTO_STREAM_REQUEST_CURRENT_STATE` optional, default `true`
- `CORTO_STREAM_PRINT_RAW` optional, default `false`
- `CORTO_STREAM_MAX_EVENTS` optional, default `25`
- `CORTO_STREAM_MAX_RUNTIME_MS` optional, default `60000`

## Why this folder exists

- It shows the ordinary wallet path with the minimum auth surface: one `X-API-Key`.
- It is useful for humans, demos, backend jobs, and operator scripts when you trust the caller with full spend authority.
- It now also gives a plain public Data Stream consumer for monitoring and event-driven tooling.
- It does not pretend to offer agent controls that ordinary wallets do not have.
- If you need spend boundaries, per-tx limits, rolling windows, transfer allowlist, or transfer memo enforcement, use `examples/agent-starter-scripts` instead.

The Data Stream script uses the standard WebSocket global. Use Node 22+ for `09-human-data-stream.mjs`.