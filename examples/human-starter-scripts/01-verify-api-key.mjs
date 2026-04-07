// /examples/human-starter-scripts/01-verify-api-key.mjs

const BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';
const API_KEY = String(process.env.CORTO_API_KEY || '').trim();

if (!API_KEY) {
  throw new Error('Missing CORTO_API_KEY');
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

const body = await fetchJson('/api/v1/verify', {
  method: 'POST',
  headers: {
    'x-api-key': API_KEY
  }
});

console.log(JSON.stringify(body, null, 2));