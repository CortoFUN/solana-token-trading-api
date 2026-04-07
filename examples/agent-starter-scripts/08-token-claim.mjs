// /examples/agent-starter-scripts/08-token-claim.mjs

import crypto from 'node:crypto';

const BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';

function resolveExecutionAuth() {
  const executionKey = String(process.env.CORTO_AGENT_EXECUTION_KEY || '').trim();
  if (executionKey) {
    return {
      headers: {
        'x-agent-execution-key': executionKey,
        'x-idempotency-key': String(process.env.CORTO_IDEMPOTENCY_KEY || `token-claim-${crypto.randomUUID()}`)
      },
      mode: 'agent'
    };
  }

  const apiKey = String(process.env.CORTO_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Missing CORTO_AGENT_EXECUTION_KEY or CORTO_API_KEY');
  }

  return {
    headers: {
      'x-api-key': apiKey
    },
    mode: 'ordinary'
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

const auth = resolveExecutionAuth();
const payload = {
  platform: String(process.env.CORTO_CLAIM_PLATFORM || 'pump')
};

const result = await fetchJson('/api/v1/token-builder/claim-cashback', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...auth.headers
  },
  body: JSON.stringify(payload)
});

console.log(JSON.stringify({ mode: auth.mode, payload, result }, null, 2));