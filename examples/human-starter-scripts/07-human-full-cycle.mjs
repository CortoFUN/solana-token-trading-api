// /examples/human-starter-scripts/07-human-full-cycle.mjs

const BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';
const API_KEY = String(process.env.CORTO_API_KEY || '').trim();

function resolveAckMode(rawValue, fallback = 'confirmed') {
  const effective = String(rawValue || fallback || 'confirmed').trim();
  if (effective !== 'sent' && effective !== 'confirmed') {
    throw new Error('ackMode must be either sent or confirmed');
  }
  return effective;
}

if (!API_KEY) {
  throw new Error('Missing CORTO_API_KEY');
}

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function requiredNumberEnv(name) {
  const value = Number(process.env[name] || '');
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Missing or invalid ${name}`);
  }
  return value;
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

async function swap(payload) {
  return fetchJson('/api/v1/swap/execute', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify(payload)
  });
}

async function getStatus(signature) {
  return fetchJson(`/api/v1/tx/${encodeURIComponent(signature)}/status`, { method: 'GET' });
}

const swapInPayload = {
  inputMint: requiredEnv('CORTO_SWAP_IN_INPUT_MINT'),
  outputMint: requiredEnv('CORTO_SWAP_IN_OUTPUT_MINT'),
  amount: requiredNumberEnv('CORTO_SWAP_IN_AMOUNT'),
  slippage: Number(process.env.CORTO_SWAP_SLIPPAGE || 10),
  pool: String(process.env.CORTO_SWAP_POOL || 'jupiter'),
  ackMode: resolveAckMode(process.env.CORTO_SWAP_IN_ACK_MODE || process.env.CORTO_SWAP_ACK_MODE, 'confirmed'),
  memo: String(process.env.CORTO_SWAP_IN_MEMO || 'human starter full cycle swap in'),
  priorityFeeSol: Number(process.env.CORTO_SWAP_PRIORITY_FEE_SOL || 0.0003),
  maxRouteMs: Number(process.env.CORTO_SWAP_MAX_ROUTE_MS || 8000)
};

const swapOutPayload = {
  inputMint: String(process.env.CORTO_SWAP_OUT_INPUT_MINT || swapInPayload.outputMint).trim(),
  outputMint: String(process.env.CORTO_SWAP_OUT_OUTPUT_MINT || swapInPayload.inputMint).trim(),
  amount: requiredNumberEnv('CORTO_SWAP_OUT_AMOUNT'),
  slippage: Number(process.env.CORTO_SWAP_SLIPPAGE || 10),
  pool: String(process.env.CORTO_SWAP_POOL || 'jupiter'),
  ackMode: resolveAckMode(process.env.CORTO_SWAP_OUT_ACK_MODE || process.env.CORTO_SWAP_ACK_MODE, 'confirmed'),
  memo: String(process.env.CORTO_SWAP_OUT_MEMO || 'human starter full cycle swap out'),
  priorityFeeSol: Number(process.env.CORTO_SWAP_PRIORITY_FEE_SOL || 0.0003),
  maxRouteMs: Number(process.env.CORTO_SWAP_MAX_ROUTE_MS || 8000)
};

const swapIn = await swap(swapInPayload);
const swapOut = await swap(swapOutPayload);
const verifyAfterSwap = String(process.env.CORTO_VERIFY_AFTER_SWAP || 'true').trim().toLowerCase() !== 'false';

const result = {
  swapIn: {
    payload: swapInPayload,
    result: swapIn
  },
  swapOut: {
    payload: swapOutPayload,
    result: swapOut
  }
};

if (verifyAfterSwap) {
  result.swapIn.status = await getStatus(swapIn.txSignature);
  result.swapOut.status = await getStatus(swapOut.txSignature);
}

console.log(JSON.stringify(result, null, 2));