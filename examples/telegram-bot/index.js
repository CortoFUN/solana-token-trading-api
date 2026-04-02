// /examples/telegram-bot/index.js

import 'dotenv/config';
import { Markup, Telegraf } from 'telegraf';

const CORTO_BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';
const CORTO_API_KEY = process.env.CORTO_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_POOL = process.env.CORTO_POOL || 'auto';

if (!CORTO_API_KEY || !TELEGRAM_BOT_TOKEN) {
  throw new Error('Missing CORTO_API_KEY or TELEGRAM_BOT_TOKEN in examples/telegram-bot/.env');
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const sessions = new Map();

function parseMint(input) {
  const text = String(input || '').trim();
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text)) {
    return text;
  }

  const embedded = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  return embedded ? embedded[0] : null;
}

function parseSignature(input) {
  const text = String(input || '').trim();
  return /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(text) ? text : null;
}

function rememberSession(userId, patch) {
  const previous = sessions.get(userId) || {};
  sessions.set(userId, {
    ...previous,
    ...patch,
    updatedAt: Date.now()
  });
}

function getSession(userId) {
  return sessions.get(userId) || null;
}

async function fetchJson(path, options) {
  const response = await fetch(`${CORTO_BASE_URL}${path}`, options);
  const text = await response.text();
  let body = {};

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Upstream returned non-JSON response with HTTP ${response.status}`);
  }

  if (!response.ok || body?.success === false) {
    throw new Error(body?.error?.message || `HTTP ${response.status}`);
  }

  return body;
}

async function getTxStatus(signature) {
  return fetchJson(`/api/v1/tx/${signature}/status`, { method: 'GET' });
}

async function tradeAndStatus(payload) {
  const trade = await fetchJson('/api/v1/lightning/trade', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': CORTO_API_KEY
    },
    body: JSON.stringify({
      ...payload,
      ackMode: 'confirmed',
      maxRouteMs: 1200
    })
  });

  const status = await getTxStatus(trade.txSignature);
  return { trade, status };
}

function formatTradeReply(label, result) {
  return [
    `${label} success.`,
    `Pool: ${result.trade.pool || 'n/a'}`,
    `Signature: ${result.trade.txSignature}`,
    `Status: ${JSON.stringify(result.status)}`
  ].join('\n');
}

async function ensureMint(ctx) {
  const mint = getSession(ctx.from.id)?.mint || null;
  if (!mint) {
    await ctx.reply('No mint is stored in the current session. Send the token mint or a token URL first.');
    return null;
  }

  return mint;
}

bot.catch(async (error, ctx) => {
  console.error('Telegram bot example error:', error);
  if (ctx) {
    await ctx.reply(`Unexpected error: ${error.message}`);
  }
});

bot.start((ctx) => ctx.reply([
  'Send a Solana mint address or a token URL that contains one.',
  'Commands:',
  '/status <signature> - fetch transaction status',
  '/mint - show the last stored mint for this chat'
].join('\n')));

bot.command('mint', (ctx) => {
  const mint = getSession(ctx.from.id)?.mint || null;
  return ctx.reply(mint ? `Current mint: ${mint}` : 'No mint stored yet. Send a token mint or URL first.');
});

bot.command('status', async (ctx) => {
  const [, rawSignature = ''] = String(ctx.message.text || '').split(/\s+/, 2);
  const signature = parseSignature(rawSignature);

  if (!signature) {
    return ctx.reply('Usage: /status <txSignature>');
  }

  try {
    const status = await getTxStatus(signature);
    return ctx.reply(`Status for ${signature}:\n${JSON.stringify(status)}`);
  } catch (error) {
    return ctx.reply(`Status fetch failed: ${error.message}`);
  }
});

bot.on('text', async (ctx) => {
  const mint = parseMint(ctx.message.text);
  if (!mint) {
    return ctx.reply('Mint not recognized. Send a valid Solana mint or a URL that contains one.');
  }

  rememberSession(ctx.from.id, { mint });
  return ctx.reply(
    `Mint detected: ${mint}\nChoose the next action.`,
    Markup.inlineKeyboard([
      [Markup.button.callback('Buy', 'ACTION_BUY')],
      [Markup.button.callback('Sell', 'ACTION_SELL')]
    ])
  );
});

bot.action('ACTION_BUY', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.reply(
    'Choose the buy size in SOL.',
    Markup.inlineKeyboard([
      [Markup.button.callback('0.01', 'BUY_0.01'), Markup.button.callback('0.02', 'BUY_0.02')],
      [Markup.button.callback('0.05', 'BUY_0.05'), Markup.button.callback('0.1', 'BUY_0.1')],
      [Markup.button.callback('0.3', 'BUY_0.3'), Markup.button.callback('0.5', 'BUY_0.5')]
    ])
  );
});

bot.action('ACTION_SELL', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.reply(
    'Choose the sell percentage.',
    Markup.inlineKeyboard([
      [Markup.button.callback('10%', 'SELL_10'), Markup.button.callback('20%', 'SELL_20')],
      [Markup.button.callback('30%', 'SELL_30'), Markup.button.callback('50%', 'SELL_50')],
      [Markup.button.callback('75%', 'SELL_75'), Markup.button.callback('100%', 'SELL_100')]
    ])
  );
});

for (const amount of ['0.01', '0.02', '0.05', '0.1', '0.3', '0.5']) {
  bot.action(`BUY_${amount}`, async (ctx) => {
    await ctx.answerCbQuery('Submitting buy...');
    const mint = await ensureMint(ctx);
    if (!mint) {
      return;
    }

    try {
      const result = await tradeAndStatus({
        action: 'buy',
        mint,
        amount: Number(amount),
        denominatedInSol: true,
        slippage: 5,
        pool: DEFAULT_POOL
      });

      rememberSession(ctx.from.id, { lastSignature: result.trade.txSignature });
      return ctx.reply(formatTradeReply('Buy', result));
    } catch (error) {
      return ctx.reply(`Buy failed: ${error.message}`);
    }
  });
}

for (const percent of ['10', '20', '30', '50', '75', '100']) {
  bot.action(`SELL_${percent}`, async (ctx) => {
    await ctx.answerCbQuery('Submitting sell...');
    const mint = await ensureMint(ctx);
    if (!mint) {
      return;
    }

    try {
      const result = await tradeAndStatus({
        action: 'sell',
        mint,
        amount: `${percent}%`,
        denominatedInSol: false,
        slippage: 8,
        pool: DEFAULT_POOL
      });

      rememberSession(ctx.from.id, { lastSignature: result.trade.txSignature });
      return ctx.reply(formatTradeReply('Sell', result));
    } catch (error) {
      return ctx.reply(`Sell failed: ${error.message}`);
    }
  });
}

async function startBot() {
  await bot.launch();
  console.log('Telegram bot example is running.');
}

await startBot();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));