// /examples/agent-starter-scripts/04-agent-transfer.mjs

import crypto from 'node:crypto';

const BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';
const EXECUTION_KEY = String(process.env.CORTO_AGENT_EXECUTION_KEY || '').trim();
const DESTINATION = String(process.env.CORTO_TRANSFER_DESTINATION || '').trim();
const AMOUNT_SOL = Number(process.env.CORTO_TRANSFER_AMOUNT_SOL || '');

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
if (!DESTINATION) {
  throw new Error('Missing CORTO_TRANSFER_DESTINATION');
}
if (!Number.isFinite(AMOUNT_SOL) || AMOUNT_SOL <= 0) {
  throw new Error('Missing or invalid CORTO_TRANSFER_AMOUNT_SOL');
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

const idempotencyKey = String(process.env.CORTO_IDEMPOTENCY_KEY || `agent-transfer-${crypto.randomUUID()}`);
const payload = {
  destination: DESTINATION,
  amountSol: AMOUNT_SOL,
  asset: 'SOL',
  ackMode: resolveAckMode(process.env.CORTO_TRANSFER_ACK_MODE, 'confirmed'),
  memo: String(process.env.CORTO_TRANSFER_MEMO || 'agent starter script transfer'),
  priorityFeeSol: Number(process.env.CORTO_TRANSFER_PRIORITY_FEE_SOL || 0.0003)
};

const body = await fetchJson('/api/v1/transfer/execute', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-agent-execution-key': EXECUTION_KEY,
    'x-idempotency-key': idempotencyKey
  },
  body: JSON.stringify(payload)
});

console.log(JSON.stringify({ idempotencyKey, payload, result: body }, null, 2));