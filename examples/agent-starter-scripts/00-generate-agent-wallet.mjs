// /examples/agent-starter-scripts/00-generate-agent-wallet.mjs

import crypto from 'node:crypto';

const BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';

function buildAgentGenerateRequestInit(requestId) {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId
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

const requestId = crypto.randomUUID();
const body = await fetchJson('/api/v1/agent-wallet/generate', buildAgentGenerateRequestInit(requestId));

console.log(JSON.stringify({
  requestId,
  baseUrl: BASE_URL,
  bundle: {
    publicKey: body.publicKey,
    privateKey: body.privateKey,
    executionKey: body.executionKey,
    settingsKey: body.settingsKey,
    executionKeyVersion: body.executionKeyVersion,
    settingsKeyVersion: body.settingsKeyVersion
  },
  profile: body.profile
}, null, 2));