// /examples/agent-starter-scripts/02-update-agent-policy.mjs

const BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';
const SETTINGS_KEY = String(process.env.CORTO_SETTINGS_KEY || '').trim();

if (!SETTINGS_KEY) {
  throw new Error('Missing CORTO_SETTINGS_KEY');
}

function readBoolean(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }

  const normalized = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid boolean for ${name}: ${raw}`);
}

function readNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number for ${name}: ${raw}`);
  }
  return value;
}

function readAllowlist() {
  const enabled = readBoolean('CORTO_ALLOWLIST_ENABLED', false);
  if (!enabled) {
    return [];
  }

  return [...new Set(
    String(process.env.CORTO_ALLOWLIST || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  )];
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

const allowlist = readAllowlist();
const payload = {
  capabilities: {
    lightningTrade: readBoolean('CORTO_LIGHTNING_TRADE_ENABLED', true),
    tokenCreate: readBoolean('CORTO_TOKEN_CREATE_ENABLED', true),
    tokenClaim: readBoolean('CORTO_TOKEN_CLAIM_ENABLED', true),
    transfer: readBoolean('CORTO_TRANSFER_ENABLED', true),
    swap: readBoolean('CORTO_SWAP_ENABLED', true)
  },
  limits: {
    perTxSol: readNumber('CORTO_PER_TX_SOL', 1),
    rollingWindows: [
      {
        frameMs: Math.floor(readNumber('CORTO_ROLLING_WINDOW_MS', 86400000)),
        asset: 'SOL',
        amount: readNumber('CORTO_ROLLING_WINDOW_SOL', 5)
      }
    ],
    transferMemoRequired: readBoolean('CORTO_TRANSFER_MEMO_REQUIRED', false),
    allowlist
  }
};

const body = await fetchJson('/api/v1/agent-wallet/settings', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-settings-key': SETTINGS_KEY
  },
  body: JSON.stringify(payload)
});

console.log(JSON.stringify({ payload, result: body }, null, 2));