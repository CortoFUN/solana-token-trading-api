# Corto Data Stream Terminal Example

Standalone visual builder for the corto.fun WebSocket data-stream API.

This example is meant to make the control-plane understandable on first launch: start with a short mode-based subscribe, inspect live server envelopes, and only then drop into advanced filters if you need them.

The example also ships with its own public-facing reference pages under `public/reference/`.

Those pages are part of the example surface and are written for external consumers. They should stay self-contained and link only to public reference material.

Production WebSocket endpoint:

```text
wss://corto.fun/data-stream
```

## Quick Start

1. Start the example app:

```bash
cd examples/data-stream-terminal
npm install
copy .env.example .env
npm start
```

2. Open the example UI in your browser.

```text
http://127.0.0.1:4010
```

The example is production-oriented and targets:

```text
wss://corto.fun/data-stream
```

First-run recommendation inside the UI:

- keep Quick mode on `all`
- the socket will connect automatically on the first toggle
- watch live JSON immediately

If you only need launches, switch to `mints`.

If you need precise filtering, switch to `Advanced Custom` and then configure pools and events below.

## What This Example Includes

- quick mode builder for `all`, `mints`, `trades`, `migrations`, and `pools`
- advanced custom builder for exact `events + pools`
- visual builder for `subscribe`, `unsubscribe`, and `current_state`
- highlighted live JSON terminal
- per-event copy button and fullscreen event viewer
- payload preview and ready-to-run snippets
- schema explorer for `handshake`, `subscription_ack`, `current_state`, and `error`
- public reference pages for overview, JSON contract, create, trade, and migration
- FIFO client buffer capped at 50 MB to prevent browser runaway
- `pause`, `play`, `clear`, search, and message-type filters

After connecting, the example refreshes pools and events from the live handshake payload.

It also refreshes supported quick modes from the live handshake payload.

The initial defaults in the UI are aligned with the current public runtime snapshot. Right now they include:

- pools: bags.fm, pump.fun, pump.swap, raydium.amm, raydium.cpmm, meteora.dlmm, letsbonk.fun, meteora.damm-v1, meteora.damm-v2
- events: create, trade, buy, sell, migration, createPool, addLiquidity, removeLiquidity, burn

`bags.fm` is exposed as a single public family. The example no longer reflects any historical fm1/fm2 split.

## Environment

Copy `.env.example` to `.env` before the first run.

The WebSocket target for the example should stay on the production path.

```env
DATA_STREAM_WS_URL=wss://corto.fun/data-stream
```

## Folder Layout

- `server.js` and env/package files stay at the example root
- browser assets live in `public/`
- public reference pages live in `public/reference/`

## Why This Example Exists

The goal is simple: make the data-stream surface understandable on the first run.

- how to start with one short subscribe payload
- how request payloads look
- which service envelopes come back
- how filters affect live data
- how the control-plane behaves in real time

This example is primarily meant to serve as a reusable reference UI.

Later, the public corto.fun builder can reuse the same interaction model inside a production design system.
