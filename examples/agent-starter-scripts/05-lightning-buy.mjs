// /examples/agent-starter-scripts/05-lightning-buy.mjs

import crypto from 'node:crypto';

const BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';

function resolveAckMode(rawValue, fallback = 'confirmed') {
  const effective = String(rawValue || fallback || 'confirmed').trim();
  if (effective !== 'sent' && effective !== 'confirmed') {
    throw new Error('ackMode must be either sent or confirmed');
  }
  return effective;
}

function resolveExecutionAuth() {
  const executionKey = String(process.env.CORTO_AGENT_EXECUTION_KEY || '').trim();
  if (executionKey) {
    return {
      headers: {
        'x-agent-execution-key': executionKey,
        'x-idempotency-key': String(process.env.CORTO_IDEMPOTENCY_KEY || `lightning-buy-${crypto.randomUUID()}`)
      },
      mode: 'agent'
    };
  }

  const apiKey = String(process.env.CORTO_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Missing CORTO_AGENT_EXECUTION_KEY or CORTO_API_KEY');
  }

  return {
    headers: {
      'x-api-key': apiKey
    },
    mode: 'ordinary'
  };
}

async function fetchJson(path, options) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok || body?.success === false) {
    throw new Error(body?.error?.message || `HTTP ${response.status}`);
  }

  return body;
}

const mint = String(process.env.CORTO_LIGHTNING_MINT || '').trim();
const amount = Number(process.env.CORTO_LIGHTNING_BUY_AMOUNT || '');

if (!mint) {
  throw new Error('Missing CORTO_LIGHTNING_MINT');
}
if (!Number.isFinite(amount) || amount <= 0) {
  throw new Error('Missing or invalid CORTO_LIGHTNING_BUY_AMOUNT');
}

const auth = resolveExecutionAuth();
const payload = {
  action: 'buy',
  mint,
  amount,
  denominatedInSol: true,
  slippage: Number(process.env.CORTO_LIGHTNING_SLIPPAGE || 5),
  pool: String(process.env.CORTO_LIGHTNING_POOL || 'auto'),
  ackMode: resolveAckMode(process.env.CORTO_LIGHTNING_ACK_MODE, 'confirmed'),
  maxRouteMs: Number(process.env.CORTO_LIGHTNING_MAX_ROUTE_MS || 1200),
  memo: String(process.env.CORTO_LIGHTNING_MEMO || 'agent starter script lightning buy'),
  priorityFeeSol: process.env.CORTO_LIGHTNING_PRIORITY_FEE_SOL ? Number(process.env.CORTO_LIGHTNING_PRIORITY_FEE_SOL) : undefined,
  jitoTipSol: process.env.CORTO_LIGHTNING_JITO_TIP_SOL ? Number(process.env.CORTO_LIGHTNING_JITO_TIP_SOL) : undefined
};

Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

const result = await fetchJson('/api/v1/lightning/trade', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...auth.headers
  },
  body: JSON.stringify(payload)
});

console.log(JSON.stringify({ mode: auth.mode, payload, result }, null, 2));