# Corto.Fun Examples

Production-oriented examples for Solana trading, local unsigned transaction flows, token creation and claim flows, partner analytics, Telegram automation, and public WebSocket streaming.

This folder is meant to answer a practical question fast:

How do I start building with Corto without reverse-engineering the whole product from scattered scripts?

The examples are intentionally separated into small runnable projects so teams, contractors, and AI coding agents can find an entry point quickly, understand the boundary of each integration mode, and move into implementation without guessing.

## Ordinary wallet vs agent wallet

- Ordinary wallet is the shortest path when one backend or operator is allowed to spend with the full authority of one `X-API-Key`.
- Agent wallet exists for the opposite trust model: you want the agent to execute only inside an explicit policy envelope instead of giving it the full wallet authority.
- Agent wallet splits execution and settings into different secrets: `X-Agent-Execution-Key` for allowed actions, `X-Settings-Key` for control-plane changes.
- Agent wallet can disable transfer entirely, require memo on transfers, cap the maximum spend per transaction, enforce rolling SOL budgets, and restrict transfers to an allowlist.
- Transport knobs like priority fee or Jito tip are still request-time execution fields, not a separate agent control-plane cap yet.
- If you hand an ordinary wallet key to an autonomous agent, that agent effectively gets the whole wallet without built-in policy brakes.

## What Corto gives you

- Lightning trading for server-side execution through an API key.
- Local Build for unsigned transaction generation with wallet-side signing.
- Token Builder for pump.fun and letsbonk.fun create plus claim flows.
- Developer Analytics for partner-scoped performance and fee visibility.
- Data Stream for free live WebSocket delivery with public schemas and live filter updates.
- Runnable examples that show actual usage patterns instead of abstract marketing diagrams.

## Why this repo is useful

Most trading API repositories fail in one of two ways: either they are too shallow to be deployable, or they are full of internal fragments that are hard to reuse.

This repo is built around clearer integration paths:

- browser plus local relay when the API key must stay off the client;
- wallet-side signing when the private key must never enter the routine server flow;
- server-to-server automation for bots and operational tools;
- agent-wallet automation for AI agents with separate spend and settings trust surfaces;
- public stream consumption for real-time event monitoring.

The goal is not to impress with complexity. The goal is to let a serious team get from evaluation to working integration with less wasted time.

## Trust model in one minute

If Corto disappears, the user should still have a path to the wallet.

That is the core product decision behind the examples in this repository.

The wallet bundle is generated once and includes:

- public key;
- private key;
- API key.

Those values are shown to the user during generation. The private key and API key must be saved by the user. They are not meant to become a fake-custodial recovery system hidden inside the platform.

This matters because it changes the story you can tell your users and partners:

- funds are not trapped behind a platform-only balance model;
- day-to-day lightning trading can run through the API key instead of passing the private key around in routine requests;
- recovery remains possible outside the platform for users who saved their wallet data.

Public explanation:

- Why Corto: https://corto.fun/why-corto
- Wallet generator: https://corto.fun/wallet/generate

## Three auth surfaces to keep straight

- Ordinary wallet execution uses X-API-Key for lightning and dedicated swap execution.
- Agent wallet execution uses X-Agent-Execution-Key and requires X-Idempotency-Key on money-moving routes.
- Agent wallet settings uses X-Settings-Key only for control-plane routes such as profile, balances, stats, history, and policy updates.

Dedicated native SOL transfer is agent-only. It does not accept X-API-Key.

If a team mixes these up, the UI feels more confusing than the backend really is. The public docs, Operations Builder, and AI Agents Wallet page are intentionally split along these three surfaces.

## Who these examples are for

- teams validating a trading product or internal tool;
- bot builders who need a fast first implementation;
- developers wiring buy, sell, and status flows into dashboards or backends;
- Telegram bot authors;
- analysts and partner operators;
- AI agents searching for runnable API integrations with explicit boundaries.

## Example index

### 0. Agent starter scripts

Folder: `examples/agent-starter-scripts`

Use this when you want copy-paste Node scripts for AI agents, server workers, cron jobs, or backend services without first building a custom relay or UI.

Included flows:

- generate an agent wallet bundle;
- load the current agent wallet profile;
- update transfer and allowlist policy;
- send Lightning buy and sell requests;
- send token-builder create and claim requests;
- execute exact-in swap with any `inputMint -> outputMint` pair;
- execute dedicated native SOL transfer with agent execution auth.

Direct file entry points:

- `examples/agent-starter-scripts/00-generate-agent-wallet.mjs`
- `examples/agent-starter-scripts/01-load-agent-profile.mjs`
- `examples/agent-starter-scripts/02-update-agent-policy.mjs`
- `examples/agent-starter-scripts/03-agent-swap.mjs`
- `examples/agent-starter-scripts/04-agent-transfer.mjs`
- `examples/agent-starter-scripts/05-lightning-buy.mjs`
- `examples/agent-starter-scripts/06-lightning-sell.mjs`
- `examples/agent-starter-scripts/07-token-create.mjs`
- `examples/agent-starter-scripts/08-token-claim.mjs`
- `examples/agent-starter-scripts/09-agent-full-cycle.mjs`
- `examples/agent-starter-scripts/10-openai-claude-agent-example.mjs`
- `examples/agent-starter-scripts/11-agent-data-stream.mjs`

Good fit for:

- AI agents that need runnable server-side examples immediately;
- teams testing agent wallet automation without browsing the whole repo;
- backend developers who want a minimal integration baseline before wrapping the API.

### 0.5. Human starter scripts

Folder: `examples/human-starter-scripts`

Use this when you want the ordinary wallet path with one `X-API-Key`, no agent control-plane, and a minimal set of copy-paste scripts for demos or backend jobs.

Included flows:

- generate a regular wallet bundle;
- verify the API key through the public verify route;
- send Lightning buy and sell requests;
- execute exact-in dedicated swap with any `inputMint -> outputMint` pair;
- send token-builder create and claim requests;
- run a simple full-cycle ordinary-wallet example;
- watch the public Data Stream from a plain human/operator script.

Direct file entry points:

- `examples/human-starter-scripts/00-generate-wallet.mjs`
- `examples/human-starter-scripts/01-verify-api-key.mjs`
- `examples/human-starter-scripts/02-lightning-buy.mjs`
- `examples/human-starter-scripts/03-lightning-sell.mjs`
- `examples/human-starter-scripts/04-ordinary-swap.mjs`
- `examples/human-starter-scripts/05-token-create.mjs`
- `examples/human-starter-scripts/06-token-claim.mjs`
- `examples/human-starter-scripts/07-human-full-cycle.mjs`
- `examples/human-starter-scripts/08-openai-claude-user-wallet-example.mjs`
- `examples/human-starter-scripts/09-human-data-stream.mjs`

Good fit for:

- humans testing the product with a normal wallet path first;
- operator scripts and backend jobs that intentionally keep full wallet authority in one place;
- demos where agent-wallet policy controls are not required.

### 1. Web client

Folder: `examples/web-client`

Use this when you want a browser UI but need the API key to stay on a local Node relay instead of exposing it in the browser.

Runtime endpoints:

- `GET /api/runtime`
- `POST /api/trade`
- `GET /api/status/:signature`

`GET /api/runtime` also includes the upstream response from `GET /api/v1/lightning/capabilities`, so the relay UI and external integrators can bootstrap pool/options/policy hints from one source.

Lightning trade requests in this example support optional `memo`, and the local relay now forwards it upstream instead of trimming it away.

The browser UI also exposes an explicit `denominatedInSol` switch, so buy and sell amount interpretation is no longer hidden behind `action === buy` assumptions.

`GET /api/status/:signature` can read back the final on-chain memo payload after composition, so the example can be used for post-trade verification instead of only signature display.

Good fit for:

- internal operator consoles;
- sales demos that need a working browser surface;
- teams building a custom frontend on top of lightning trading.

### 2. Local wallet client

Folder: `examples/local-wallet-client`

Use this when you want the API to prepare an unsigned transaction while signing stays on the wallet side, for example in Phantom.

Runtime endpoints:

- `GET /api/runtime`
- `POST /api/build-trade`
- `GET /api/status/:signature`

`GET /api/runtime` also includes the upstream response from `GET /api/v1/local/capabilities`, so the relay UI and external integrators can discover the unsigned-build contract without duplicating rules locally.

Local build requests in this example support optional `memo`, and the relay now forwards it to upstream local build instead of dropping it before transaction construction.

The browser UI also exposes an explicit `denominatedInSol` switch, so local unsigned builds can be tested both as SOL-notional requests and as token-amount or percentage requests.

After Phantom broadcast, `GET /api/status/:signature` can read back the final on-chain memo payload if the transaction included a memo instruction.

Good fit for:

- teams that do not want routine server-side access to the private key;
- flows where the wallet should remain the final signing authority;
- products that need a cleaner trust story around transaction approval.

### 3. Telegram bot

Folder: `examples/telegram-bot`

Use this when you want fast operational trading commands inside Telegram.

Capabilities:

- mint parsing from raw text and token URLs;
- inline buy and sell actions;
- mint inspection;
- signature status lookup.

Good fit for:

- trading scripts with chat control;
- small operator teams;
- alert-driven flows that need a fast action surface.

### 4. Developer analytics board

Folder: `examples/dev-analytics-board`

Use this when you want a local browser dashboard for partner-scoped analytics while keeping the API key on a local relay.

Runtime endpoints:

- `GET /api/runtime`
- `POST /api/analytics`

Access model:

- the relay verifies the API key against the upstream wallet verification path;
- analytics is available only for the partner wallet derived from that API key;
- `projectId` is optional and acts as an extra filter inside that partner scope.

Good fit for:

- partners tracking fee attribution;
- teams measuring performance windows;
- dashboards that should stay close to the real API contract.

### 5. Token Builder client

Folder: `examples/token-builder-client`

Use this when you want a local browser UI and relay for token creation plus reward claim, while keeping the API key off the browser.

Runtime endpoints:

- `GET /api/runtime`
- `POST /api/create`
- `POST /api/claim`

`GET /api/runtime` already includes the upstream `GET /api/v1/token-builder/capabilities` response, which now sits alongside Lightning and Local capabilities as the same DX pattern.

Good fit for:

- launch teams testing create flows from a local console;
- operators who need one place for metadata upload plus claim actions;
- contractors or AI agents that need a runnable reference for multipart token-create requests.

### 6. Data Stream terminal

Folder: `examples/data-stream-terminal`

This example is a local app for the public WebSocket stream and its reference surface.

- Terminal page for public WebSocket stream monitoring and quick buy/sell actions.
- Launch Studio page for token create plus claim flows through the same relay.

Use it when you need to:

- connect to the public stream fast;
- test filter messages before wiring a production client;
- inspect handshake, ack, current state, and error envelopes;
- watch real JSON event payloads live;
- understand what each event family really exposes today;
- use a concrete reference UI and public schema surface instead of guessing the contract from raw messages.

Public builder and reference pages:

- Builder: https://corto.fun/data-stream/builder
- Overview: https://corto.fun/data-stream/reference
- JSON contract: https://corto.fun/data-stream/reference/json-contract
- Create event: https://corto.fun/data-stream/reference/create-event
- Trade event: https://corto.fun/data-stream/reference/trade-event
- Migration event: https://corto.fun/data-stream/reference/migration-event
- CreatePool event: https://corto.fun/data-stream/reference/create-pool-event
- Liquidity event: https://corto.fun/data-stream/reference/liquidity-event
- Burn event: https://corto.fun/data-stream/reference/burn-event

### 7. Trading Terminal v1

Folder: `examples/trading-terminal-v1`

This example is a separate user-facing local app built around the same Corto surfaces:

- FluxBoard page for compact launchpad trading with Lightning API key or Local Phantom flow.
- StarForge page for token create plus cashback / creator-fee claim actions.

Use it when you need to:

- hand a non-developer a local trading MVP instead of a WebSocket contract demo;
- watch launchpad flow in a compact three-rail screen;
- trade from one modal using either Corto Lightning auth or Phantom local signing;
- create tokens and claim rewards from the same local app;
- run a product-style example with less protocol noise on screen.

Production endpoint:

- `wss://corto.fun/data-stream`

Local relay endpoints in this example:

- `GET /api/runtime`
- `POST /api/lightning/trade`
- `POST /api/local/build-trade`
- `GET /api/status/:signature`
- `POST /api/token-builder/create`
- `POST /api/token-builder/claim`

## Data Stream in detail

The Data Stream is a free public WebSocket surface for live JSON events and service envelopes.

It is designed to be useful both as a monitoring surface and as an integration surface.

Current public access model:

- free access;
- one connection per IP;
- filters updated through control messages;
- normal filter changes do not require reconnecting the socket.

Create events also support payload depth control through `create.detail` with public levels `min`, `mid`, and `full`.

### Control-plane messages

The public request contract currently supports:

- `subscribe`
- `unsubscribe`
- `current_state`

There are two ways to subscribe.

Quick mode:

- `all`
- `mints`
- `trades`
- `migrations`
- `pools`

Focused mode:

- explicit `events`
- explicit `pools`

Important contract rules:

- if `mode` is present, the server expands it into the effective filter;
- `mode` must not be combined with `events` or `pools` in the same message;
- if `events` are omitted, the request means all currently deliverable events;
- if `pools` are omitted, the request means all currently available pools;
- `trade` is an alias that expands to `buy` plus `sell`.
- `create.detail` affects only create events and is echoed back in service envelopes as `effectiveFilter.createDetail`.

Example requests:

```json
{
  "type": "subscribe",
  "mode": "all"
}
```

```json
{
  "type": "subscribe",
  "mode": "mints",
  "create": {
    "detail": "mid"
  }
}
```

```json
{
  "type": "subscribe",
  "events": ["create", "trade"],
  "pools": ["letsbonk.fun"],
  "create": {
    "detail": "min"
  }
}
```

```json
{
  "type": "current_state"
}
```

### Service envelopes

Every client should understand these service message families:

- `handshake`
- `subscription_ack`
- `current_state`
- `error`

What they mean:

- `handshake`: initial connection state, available pools, available events, supported modes, supported messages, and effective filter state;
- `subscription_ack`: confirmation after subscribe or unsubscribe changes;
- `current_state`: snapshot of the effective live filter;
- `error`: structured rejection for invalid request shapes or unsupported combinations.

The handshake and current-state envelopes expose the live public runtime surface, including the currently available pools, event families, and the active `createDetail` value.

### Event families covered by the public contract

The updated reference surface covers these public families:

- create
- trade
- buy
- sell
- migration
- createPool
- addLiquidity
- removeLiquidity
- burn

The linked reference pages matter because they do not pretend all values are equally guaranteed.

They distinguish between:

- keys that are present;
- values that are currently reliable;
- values that remain conditional, nullable, pool-specific, or transport-specific.

That distinction is important for both humans and AI agents. It prevents false assumptions when building production parsing logic.

### Pool families currently surfaced publicly

The current public runtime snapshot includes:

- bags.fm
- pump.fun
- pump.swap
- raydium.amm
- raydium.cpmm
- meteora.dlmm
- letsbonk.fun
- meteora.damm-v1
- meteora.damm-v2

The exact available list should always be treated as live runtime data from the handshake or current-state envelopes, not as a hardcoded permanent constant.

### Why the schema pages are useful

The reference pages are not decorative docs. They are intended to help answer real integration questions such as:

- which event shape should I branch on;
- which values can legitimately be `null`;
- which fields are pool-family specific;
- what is guaranteed by the public contract and what is still conditional;
- which event families have observed production payloads already.

That makes the Data Stream useful for:

- browser consoles;
- backend consumers;
- monitoring tools;
- trading scripts;
- Telegram bots;
- AI agents searching for a usable Solana event stream API.

## Quickstart

Each example is a standalone project with its own local setup.

### Telegram bot

```bash
cd examples/telegram-bot
npm install
copy .env.example .env
npm start
```

### Web client

```bash
cd examples/web-client
npm install
copy .env.example .env
npm start
```

### Local wallet client

```bash
cd examples/local-wallet-client
npm install
copy .env.example .env
npm start
```

### Developer analytics board

```bash
cd examples/dev-analytics-board
npm install
copy .env.example .env
npm start
```

### Data Stream terminal

```bash
cd examples/data-stream-terminal
npm install
npm start
```

### Trading Terminal v1

```bash
cd examples/trading-terminal-v1
npm install
npm start
```

## First lightning trade request

```bash
curl --request POST \
  --url 'https://corto.fun/api/v1/lightning/trade' \
  --header 'Content-Type: application/json' \
  --header 'X-API-Key: YOUR_API_KEY' \
  --data '{
    "action": "buy",
    "mint": "TOKEN_MINT",
    "amount": 0.01,
    "denominatedInSol": true,
    "slippage": 5,
    "pool": "auto",
    "ackMode": "confirmed",
    "maxRouteMs": 1200
  }'
```

Protected endpoints in this repository use one SSOT auth contract:

- send the API key only in the `X-API-Key` header;
- do not duplicate it in query parameters or JSON bodies.

## For developers and AI agents

If you are evaluating this repository as a target for integration work, start with the example that matches your boundary.

- Need copy-paste backend scripts for AI agents or workers: `examples/agent-starter-scripts`
- Need browser UI plus a safe place for the API key: `examples/web-client`
- Need wallet-side signing: `examples/local-wallet-client`
- Need partner analytics: `examples/dev-analytics-board`
- Need public WebSocket event streaming: `examples/data-stream-terminal`
- Need a user-facing local trading and launch app: `examples/trading-terminal-v1`
- Need chat-driven trading flows: `examples/telegram-bot`

Why agents can work with this repo faster:

- example folders are isolated;
- entry points are explicit;
- runtime endpoints are easy to find;
- request and response expectations are visible;
- the Data Stream surface has a linked builder plus contract docs.

That structure reduces ambiguity when an AI agent is asked to:

- find the right integration mode;
- scaffold a new project against the API;
- generate a minimal relay or bot;
- inspect event schemas before writing parsing logic;
- compare server-side execution against wallet-side signing.

## Useful links

- API repo: https://github.com/CortoFUN/solana-token-trading-api
- Docs portal: https://corto.fun/docs
- Examples page: https://corto.fun/docs/examples
- Data Stream builder: https://corto.fun/data-stream/builder
- Data Stream reference: https://corto.fun/data-stream/reference
- Wallet generator: https://corto.fun/wallet/generate
- Why Corto: https://corto.fun/why-corto
