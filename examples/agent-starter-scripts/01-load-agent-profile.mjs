// /examples/agent-starter-scripts/01-load-agent-profile.mjs

const BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';
const SETTINGS_KEY = String(process.env.CORTO_SETTINGS_KEY || '').trim();

if (!SETTINGS_KEY) {
  throw new Error('Missing CORTO_SETTINGS_KEY');
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

const body = await fetchJson('/api/v1/agent-wallet/profile', {
  method: 'GET',
  headers: {
    'x-settings-key': SETTINGS_KEY
  }
});

console.log(JSON.stringify(body, null, 2));