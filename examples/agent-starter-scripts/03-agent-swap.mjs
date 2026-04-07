// /examples/agent-starter-scripts/03-agent-swap.mjs

import crypto from 'node:crypto';

const BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';
const EXECUTION_KEY = String(process.env.CORTO_AGENT_EXECUTION_KEY || '').trim();
const INPUT_MINT = String(process.env.CORTO_SWAP_INPUT_MINT || '').trim();
const OUTPUT_MINT = String(process.env.CORTO_SWAP_OUTPUT_MINT || '').trim();
const AMOUNT = Number(process.env.CORTO_SWAP_AMOUNT || '');

function resolveAckMode(rawValue, fallback = 'confirmed') {
  const effective = String(rawValue || fallback || 'confirmed').trim();
  if (effective !== 'sent' && effective !== 'confirmed') {
    throw new Error('ackMode must be either sent or confirmed');
  }
  return effective;
}

if (!EXECUTION_KEY) {
  throw new Error('Missing CORTO_AGENT_EXECUTION_KEY');
}
if (!INPUT_MINT) {
  throw new Error('Missing CORTO_SWAP_INPUT_MINT');
}
if (!OUTPUT_MINT) {
  throw new Error('Missing CORTO_SWAP_OUTPUT_MINT');
}
if (!Number.isFinite(AMOUNT) || AMOUNT <= 0) {
  throw new Error('Missing or invalid CORTO_SWAP_AMOUNT');
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

const idempotencyKey = String(process.env.CORTO_IDEMPOTENCY_KEY || `agent-swap-${crypto.randomUUID()}`);
const payload = {
  inputMint: INPUT_MINT,
  outputMint: OUTPUT_MINT,
  amount: AMOUNT,
  slippage: Number(process.env.CORTO_SWAP_SLIPPAGE || 10),
  pool: String(process.env.CORTO_SWAP_POOL || 'jupiter'),
  ackMode: resolveAckMode(process.env.CORTO_SWAP_ACK_MODE, 'confirmed'),
  memo: String(process.env.CORTO_SWAP_MEMO || 'agent starter script swap'),
  priorityFeeSol: Number(process.env.CORTO_SWAP_PRIORITY_FEE_SOL || 0.0003),
  maxRouteMs: Number(process.env.CORTO_SWAP_MAX_ROUTE_MS || 8000)
};

const body = await fetchJson('/api/v1/swap/execute', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-agent-execution-key': EXECUTION_KEY,
    'x-idempotency-key': idempotencyKey
  },
  body: JSON.stringify(payload)
});

console.log(JSON.stringify({ idempotencyKey, payload, result: body }, null, 2));