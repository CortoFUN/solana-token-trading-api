// /examples/agent-starter-scripts/09-agent-full-cycle.mjs

import crypto from 'node:crypto';

const BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';
const EXECUTION_KEY = String(process.env.CORTO_AGENT_EXECUTION_KEY || '').trim();

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

function buildIdempotencyKey(label) {
  return `${label}-${crypto.randomUUID()}`;
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

async function callSwap(payload, label) {
  return fetchJson('/api/v1/swap/execute', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-agent-execution-key': EXECUTION_KEY,
      'x-idempotency-key': buildIdempotencyKey(label)
    },
    body: JSON.stringify(payload)
  });
}

async function callTransfer(payload) {
  return fetchJson('/api/v1/transfer/execute', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-agent-execution-key': EXECUTION_KEY,
      'x-idempotency-key': buildIdempotencyKey('full-cycle-transfer')
    },
    body: JSON.stringify(payload)
  });
}

const swapInPayload = {
  inputMint: String(process.env.CORTO_SWAP_IN_INPUT_MINT || '').trim(),
  outputMint: String(process.env.CORTO_SWAP_IN_OUTPUT_MINT || '').trim(),
  amount: Number(process.env.CORTO_SWAP_IN_AMOUNT || ''),
  slippage: Number(process.env.CORTO_SWAP_IN_SLIPPAGE || 10),
  pool: String(process.env.CORTO_SWAP_IN_POOL || 'jupiter'),
  ackMode: resolveAckMode(process.env.CORTO_SWAP_IN_ACK_MODE || process.env.CORTO_SWAP_ACK_MODE, 'confirmed'),
  memo: String(process.env.CORTO_SWAP_IN_MEMO || 'agent full cycle swap in'),
  priorityFeeSol: Number(process.env.CORTO_SWAP_IN_PRIORITY_FEE_SOL || 0.0003),
  maxRouteMs: Number(process.env.CORTO_SWAP_IN_MAX_ROUTE_MS || 8000)
};

const swapOutPayload = {
  inputMint: String(process.env.CORTO_SWAP_OUT_INPUT_MINT || swapInPayload.outputMint).trim(),
  outputMint: String(process.env.CORTO_SWAP_OUT_OUTPUT_MINT || swapInPayload.inputMint).trim(),
  amount: Number(process.env.CORTO_SWAP_OUT_AMOUNT || ''),
  slippage: Number(process.env.CORTO_SWAP_OUT_SLIPPAGE || 10),
  pool: String(process.env.CORTO_SWAP_OUT_POOL || 'jupiter'),
  ackMode: resolveAckMode(process.env.CORTO_SWAP_OUT_ACK_MODE || process.env.CORTO_SWAP_ACK_MODE, 'confirmed'),
  memo: String(process.env.CORTO_SWAP_OUT_MEMO || 'agent full cycle swap out'),
  priorityFeeSol: Number(process.env.CORTO_SWAP_OUT_PRIORITY_FEE_SOL || 0.0003),
  maxRouteMs: Number(process.env.CORTO_SWAP_OUT_MAX_ROUTE_MS || 8000)
};

if (!swapInPayload.inputMint || !swapInPayload.outputMint || !Number.isFinite(swapInPayload.amount) || swapInPayload.amount <= 0) {
  throw new Error('Missing or invalid CORTO_SWAP_IN_INPUT_MINT, CORTO_SWAP_IN_OUTPUT_MINT, or CORTO_SWAP_IN_AMOUNT');
}
if (!swapOutPayload.inputMint || !swapOutPayload.outputMint || !Number.isFinite(swapOutPayload.amount) || swapOutPayload.amount <= 0) {
  throw new Error('Missing or invalid CORTO_SWAP_OUT_INPUT_MINT, CORTO_SWAP_OUT_OUTPUT_MINT, or CORTO_SWAP_OUT_AMOUNT');
}

const transferDestination = String(process.env.CORTO_TRANSFER_DESTINATION || '').trim();
const transferEnabled = process.env.CORTO_TRANSFER_ENABLED_IN_FULL_CYCLE
  ? ['1', 'true', 'yes', 'on'].includes(String(process.env.CORTO_TRANSFER_ENABLED_IN_FULL_CYCLE).trim().toLowerCase())
  : Boolean(transferDestination);

const transferPayload = transferEnabled ? {
  destination: transferDestination,
  amountSol: Number(process.env.CORTO_TRANSFER_AMOUNT_SOL || 0.001),
  asset: 'SOL',
  ackMode: resolveAckMode(process.env.CORTO_TRANSFER_ACK_MODE, 'confirmed'),
  memo: String(process.env.CORTO_TRANSFER_MEMO || 'agent full cycle transfer'),
  priorityFeeSol: Number(process.env.CORTO_TRANSFER_PRIORITY_FEE_SOL || 0.0003)
} : null;

if (transferEnabled && !transferPayload.destination) {
  throw new Error('CORTO_TRANSFER_DESTINATION is required when transfer is enabled in full cycle');
}

const swapIn = await callSwap(swapInPayload, 'full-cycle-swap-in');
const swapOut = await callSwap(swapOutPayload, 'full-cycle-swap-out');
const transfer = transferPayload ? await callTransfer(transferPayload) : null;

console.log(JSON.stringify({ swapInPayload, swapIn, swapOutPayload, swapOut, transferPayload, transfer }, null, 2));