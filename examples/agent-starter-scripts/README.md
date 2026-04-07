# Agent Starter Scripts

Copy-paste Node scripts for Corto agent wallet automation.

This folder is for backend teams and AI agents that want the shortest path from evaluation to a working integration.

No extra package is required. These scripts use Node 18+ built-in `fetch` and `crypto.randomUUID()`.

## Included scripts

- `00-generate-agent-wallet.mjs` creates a new agent wallet bundle.
- `01-load-agent-profile.mjs` loads the current agent wallet profile through `X-Settings-Key`.
- `02-update-agent-policy.mjs` updates transfer, swap, memo, rolling limits, and allowlist policy.
- `03-agent-swap.mjs` executes dedicated exact-in swap for any `inputMint -> outputMint` pair.
- `04-agent-transfer.mjs` executes dedicated native SOL transfer through `X-Agent-Execution-Key`.
- `05-lightning-buy.mjs` submits a Lightning buy with either `X-API-Key` or `X-Agent-Execution-Key`.
- `06-lightning-sell.mjs` submits a Lightning sell with either `X-API-Key` or `X-Agent-Execution-Key`.
- `07-token-create.mjs` submits token-builder create with multipart image upload.
- `08-token-claim.mjs` submits token-builder claim for pump cashback or letsbonk creator fees.
- `09-agent-full-cycle.mjs` runs swap in, swap out, then optional transfer in one script.
- `10-openai-claude-agent-example.mjs` exports ready-to-paste helper functions for agent runtimes.
- `11-agent-data-stream.mjs` opens the public WebSocket data stream and prints parsed service and event envelopes.

## Quick start

```bash
cd examples/agent-starter-scripts
node 00-generate-agent-wallet.mjs
```

Env template:

```bash
copy .env.example .env
```

Then export the keys you want to use:

```bash
set CORTO_BASE_URL=http://127.0.0.1:3000
set CORTO_SETTINGS_KEY=PUT_SETTINGS_KEY_HERE
set CORTO_AGENT_EXECUTION_KEY=PUT_EXECUTION_KEY_HERE
```

Load the profile:

```bash
node 01-load-agent-profile.mjs
```

Enable transfer and set a one-address allowlist:

```bash
set CORTO_TRANSFER_ENABLED=true
set CORTO_ALLOWLIST_ENABLED=true
set CORTO_ALLOWLIST=A4QjfRhMo8DzcQFb2cxbiS2gPak56sRuQABbNNGTwzT
node 02-update-agent-policy.mjs
```

Run an exact-in swap:

```bash
set CORTO_SWAP_INPUT_MINT=So11111111111111111111111111111111111111112
set CORTO_SWAP_OUTPUT_MINT=Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
set CORTO_SWAP_AMOUNT=0.005
node 03-agent-swap.mjs
```

Run a native SOL transfer:

```bash
set CORTO_TRANSFER_DESTINATION=A4QjfRhMo8DzcQFb2cxbiS2gPak56sRuQABbNNGTwzT
set CORTO_TRANSFER_AMOUNT_SOL=0.001
node 04-agent-transfer.mjs
```

Run Lightning buy and sell:

```bash
set CORTO_API_KEY=PUT_API_KEY_HERE
set CORTO_LIGHTNING_MINT=So11111111111111111111111111111111111111112
set CORTO_LIGHTNING_BUY_AMOUNT=0.01
node 05-lightning-buy.mjs

set CORTO_LIGHTNING_SELL_AMOUNT=10%
node 06-lightning-sell.mjs
```

Run token create and claim:

```bash
set CORTO_TOKEN_IMAGE_PATH=./token-image.png
set CORTO_TOKEN_NAME=Corto Nova
set CORTO_TOKEN_SYMBOL=NOVA
set CORTO_TOKEN_DESCRIPTION=Example launch from agent starter scripts
node 07-token-create.mjs

set CORTO_CLAIM_PLATFORM=letsbonk
node 08-token-claim.mjs
```

Run the full-cycle agent example:

```bash
set CORTO_SWAP_IN_INPUT_MINT=So11111111111111111111111111111111111111112
set CORTO_SWAP_IN_OUTPUT_MINT=Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
set CORTO_SWAP_IN_AMOUNT=0.005
set CORTO_SWAP_OUT_AMOUNT=0.39
set CORTO_TRANSFER_DESTINATION=A4QjfRhMo8DzcQFb2cxbiS2gPak56sRuQABbNNGTwzT
node 09-agent-full-cycle.mjs
```

Watch the public Data Stream from an agent/worker process:

```bash
set CORTO_STREAM_MODE=trades
set CORTO_STREAM_MAX_EVENTS=20
node 11-agent-data-stream.mjs
```

## Environment variables

- `CORTO_BASE_URL` default: `https://corto.fun`
- `CORTO_SETTINGS_KEY` for profile and policy scripts
- `CORTO_AGENT_EXECUTION_KEY` for swap and transfer scripts
- `CORTO_IDEMPOTENCY_KEY` optional override for swap and transfer
- `CORTO_TRANSFER_ENABLED` optional, default `true`
- `CORTO_SWAP_ENABLED` optional, default `true`
- `CORTO_TRANSFER_MEMO_REQUIRED` optional, default `false`
- `CORTO_ALLOWLIST_ENABLED` optional, default `false`
- `CORTO_ALLOWLIST` optional comma-separated allowlist
- `CORTO_PER_TX_SOL` optional, default `1`
- `CORTO_ROLLING_WINDOW_MS` optional, default `86400000`
- `CORTO_ROLLING_WINDOW_SOL` optional, default `5`
- `CORTO_SWAP_INPUT_MINT` required for swap
- `CORTO_SWAP_OUTPUT_MINT` required for swap
- `CORTO_SWAP_AMOUNT` required for swap
- `CORTO_SWAP_SLIPPAGE` optional, default `10`
- `CORTO_SWAP_POOL` optional, default `jupiter`
- `CORTO_SWAP_PRIORITY_FEE_SOL` optional, default `0.0003`
- `CORTO_SWAP_MAX_ROUTE_MS` optional, default `8000`
- `CORTO_TRANSFER_DESTINATION` required for transfer
- `CORTO_TRANSFER_AMOUNT_SOL` required for transfer
- `CORTO_TRANSFER_PRIORITY_FEE_SOL` optional, default `0.0003`
- `CORTO_API_KEY` optional alternative auth for Lightning and token-builder examples
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
- `CORTO_TRANSFER_ENABLED_IN_FULL_CYCLE` optional, default auto based on destination presence
- `CORTO_STREAM_WS_URL` optional, default `wss://corto.fun/data-stream`
- `CORTO_STREAM_MODE` optional quick mode: `all`, `mints`, `trades`, `migrations`, `pools`
- `CORTO_STREAM_EVENTS` optional comma-separated advanced events filter
- `CORTO_STREAM_POOLS` optional comma-separated advanced pools filter
- `CORTO_STREAM_CREATE_DETAIL` optional create detail level: `min`, `mid`, `full`
- `CORTO_STREAM_REQUEST_CURRENT_STATE` optional, default `true`
- `CORTO_STREAM_PRINT_RAW` optional, default `false`
- `CORTO_STREAM_MAX_EVENTS` optional, default `25`
- `CORTO_STREAM_MAX_RUNTIME_MS` optional, default `60000`

## Why these scripts help

- They show the real auth split between `X-Settings-Key` and `X-Agent-Execution-Key`.
- They show that dedicated swap is not SOL-only and accepts any exact-in `inputMint -> outputMint` pair.
- They show both ordinary wallet and agent-wallet execution on the routes that support both.
- They give one agent-friendly WebSocket consumer example for the public Data Stream surface.
- They can be pasted into a worker, bot, agent loop, or internal service with almost no cleanup.
- `10-openai-claude-agent-example.mjs` also gives reusable helper functions for OpenAI, Claude, and similar agent runtimes.

The Data Stream script uses the standard WebSocket global. Use Node 22+ for `11-agent-data-stream.mjs`.