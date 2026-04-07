// /examples/human-starter-scripts/03-lightning-sell.mjs

const BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';
const API_KEY = String(process.env.CORTO_API_KEY || '').trim();
const MINT = String(process.env.CORTO_LIGHTNING_MINT || '').trim();
const AMOUNT = String(process.env.CORTO_LIGHTNING_SELL_AMOUNT || '').trim();

function resolveAckMode(rawValue, fallback = 'confirmed') {
  const effective = String(rawValue || fallback || 'confirmed').trim();
  if (effective !== 'sent' && effective !== 'confirmed') {
    throw new Error('ackMode must be either sent or confirmed');
  }
  return effective;
}

if (!API_KEY) throw new Error('Missing CORTO_API_KEY');
if (!MINT) throw new Error('Missing CORTO_LIGHTNING_MINT');
if (!AMOUNT) throw new Error('Missing CORTO_LIGHTNING_SELL_AMOUNT');

async function fetchJson(path, options) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok || body?.success === false) {
    throw new Error(body?.error?.message || `HTTP ${response.status}`);
  }

  return body;
}

const payload = {
  action: 'sell',
  mint: MINT,
  amount: AMOUNT,
  denominatedInSol: false,
  slippage: Number(process.env.CORTO_LIGHTNING_SLIPPAGE || 5),
  pool: String(process.env.CORTO_LIGHTNING_POOL || 'auto'),
  ackMode: resolveAckMode(process.env.CORTO_LIGHTNING_ACK_MODE, 'confirmed'),
  memo: String(process.env.CORTO_LIGHTNING_MEMO || 'human starter script sell'),
  priorityFeeSol: Number(process.env.CORTO_LIGHTNING_PRIORITY_FEE_SOL || 0.0003),
  jitoTipSol: Number(process.env.CORTO_LIGHTNING_JITO_TIP_SOL || 0),
  maxRouteMs: Number(process.env.CORTO_LIGHTNING_MAX_ROUTE_MS || 1200)
};

const body = await fetchJson('/api/v1/lightning/trade', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-api-key': API_KEY
  },
  body: JSON.stringify(payload)
});

console.log(JSON.stringify({ payload, result: body }, null, 2));