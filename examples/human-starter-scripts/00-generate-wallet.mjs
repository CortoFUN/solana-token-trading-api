// /examples/human-starter-scripts/00-generate-wallet.mjs

const BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';

function buildHumanGenerateRequestInit() {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({})
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

const body = await fetchJson('/api/v1/wallet/generate', buildHumanGenerateRequestInit());

console.log(JSON.stringify(body, null, 2));