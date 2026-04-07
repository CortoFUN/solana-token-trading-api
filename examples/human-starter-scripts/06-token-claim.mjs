// /examples/human-starter-scripts/06-token-claim.mjs

const BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';
const API_KEY = String(process.env.CORTO_API_KEY || '').trim();

if (!API_KEY) throw new Error('Missing CORTO_API_KEY');

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
  platform: String(process.env.CORTO_CLAIM_PLATFORM || 'pump')
};

const body = await fetchJson('/api/v1/token-builder/claim-cashback', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-api-key': API_KEY
  },
  body: JSON.stringify(payload)
});

console.log(JSON.stringify({ payload, result: body }, null, 2));