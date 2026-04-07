# Telegram Bot Example

Standalone Telegram trading bot for Corto.Fun lightning mode.

## What this example does

- Starts a Telegram bot with `npm start`.
- Accepts either a raw Solana mint or a token URL containing the mint.
- Stores the current mint per Telegram user session.
- Sends buy and sell requests through `POST /api/v1/lightning/trade`.
- Fetches transaction status after the trade completes.

## Quick start

```bash
cd examples/telegram-bot
npm install
copy .env.example .env
npm start
```

## Environment

- `CORTO_BASE_URL=https://corto.fun`
- `CORTO_API_KEY=PUT_YOUR_API_KEY_HERE`
- `TELEGRAM_BOT_TOKEN=PUT_YOUR_TELEGRAM_BOT_TOKEN_HERE`
- `CORTO_POOL=auto`

## Commands

- Send a mint or token URL to select a token.
- Use the inline buy buttons for `0.01`, `0.02`, `0.05`, `0.1`, `0.3`, `0.5` SOL.
- Use the inline sell buttons for `10%`, `20%`, `30%`, `50%`, `75%`, `100%`.
- `/mint` shows the currently stored mint.
- `/status <signature>` fetches transaction status manually.

## Behavior

- API key stays server-side only.
- API key is sent upstream only via the `X-API-Key` header.
- Trades are sent with `ackMode=confirmed` and `maxRouteMs=1200`.
- The process stops cleanly on `SIGINT` and `SIGTERM`.