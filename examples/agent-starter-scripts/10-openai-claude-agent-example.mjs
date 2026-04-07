// /examples/agent-starter-scripts/10-openai-claude-agent-example.mjs

import crypto from 'node:crypto';

const DEFAULT_BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function createAgentExecutionHeaders(executionKey, idempotencyKey) {
  const normalizedKey = String(executionKey || '').trim();
  if (!normalizedKey) {
    throw new Error('executionKey is required');
  }

  return {
    'content-type': 'application/json',
    'x-agent-execution-key': normalizedKey,
    'x-idempotency-key': String(idempotencyKey || crypto.randomUUID())
  };
}

function createSettingsHeaders(settingsKey) {
  const normalizedKey = String(settingsKey || '').trim();
  if (!normalizedKey) {
    throw new Error('settingsKey is required');
  }

  return {
    'content-type': 'application/json',
    'x-settings-key': normalizedKey
  };
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok || body?.success === false) {
    throw new Error(body?.error?.message || `HTTP ${response.status}`);
  }

  return body;
}

export async function callCortoSwap({ baseUrl = DEFAULT_BASE_URL, executionKey, idempotencyKey, inputMint, outputMint, amount, slippage = 10, pool = 'jupiter', ackMode = 'confirmed', memo = 'AI agent swap', priorityFeeSol = 0.0003, maxRouteMs = 8000 }) {
  return fetchJson(`${normalizeBaseUrl(baseUrl)}/api/v1/swap/execute`, {
    method: 'POST',
    headers: createAgentExecutionHeaders(executionKey, idempotencyKey),
    body: JSON.stringify({ inputMint, outputMint, amount, slippage, pool, ackMode, memo, priorityFeeSol, maxRouteMs })
  });
}

export async function callCortoTransfer({ baseUrl = DEFAULT_BASE_URL, executionKey, idempotencyKey, destination, amountSol, ackMode = 'confirmed', memo = 'AI agent transfer', priorityFeeSol = 0.0003 }) {
  return fetchJson(`${normalizeBaseUrl(baseUrl)}/api/v1/transfer/execute`, {
    method: 'POST',
    headers: createAgentExecutionHeaders(executionKey, idempotencyKey),
    body: JSON.stringify({ destination, amountSol, asset: 'SOL', ackMode, memo, priorityFeeSol })
  });
}

export async function updateAgentPolicy({ baseUrl = DEFAULT_BASE_URL, settingsKey, capabilities, limits }) {
  return fetchJson(`${normalizeBaseUrl(baseUrl)}/api/v1/agent-wallet/settings`, {
    method: 'POST',
    headers: createSettingsHeaders(settingsKey),
    body: JSON.stringify({ capabilities, limits })
  });
}

export async function callLightningTrade({ baseUrl = DEFAULT_BASE_URL, authHeader, authKey, idempotencyKey, action, mint, amount, denominatedInSol = false, slippage = 5, pool = 'auto', ackMode = 'confirmed', memo = 'AI agent lightning trade', maxRouteMs = 1200 }) {
  const headers = { 'content-type': 'application/json' };
  if (authHeader === 'x-agent-execution-key') {
    headers['x-agent-execution-key'] = String(authKey || '').trim();
    headers['x-idempotency-key'] = String(idempotencyKey || crypto.randomUUID());
  } else {
    headers['x-api-key'] = String(authKey || '').trim();
  }

  return fetchJson(`${normalizeBaseUrl(baseUrl)}/api/v1/lightning/trade`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, mint, amount, denominatedInSol, slippage, pool, ackMode, memo, maxRouteMs })
  });
}

export async function callTokenBuilderClaim({ baseUrl = DEFAULT_BASE_URL, authHeader, authKey, idempotencyKey, platform = 'pump' }) {
  const headers = { 'content-type': 'application/json' };
  if (authHeader === 'x-agent-execution-key') {
    headers['x-agent-execution-key'] = String(authKey || '').trim();
    headers['x-idempotency-key'] = String(idempotencyKey || crypto.randomUUID());
  } else {
    headers['x-api-key'] = String(authKey || '').trim();
  }

  return fetchJson(`${normalizeBaseUrl(baseUrl)}/api/v1/token-builder/claim-cashback`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ platform })
  });
}

export async function callTokenBuilderCreate({ baseUrl = DEFAULT_BASE_URL, authHeader, authKey, idempotencyKey, imageBlob, imageFilename = 'token-image.png', platform = 'pump', name, symbol, description, website, twitter, telegram, migrateType, cashbackEnabled = true, devBuyEnabled = false, devBuySol }) {
  const headers = {};
  if (authHeader === 'x-agent-execution-key') {
    headers['x-agent-execution-key'] = String(authKey || '').trim();
    headers['x-idempotency-key'] = String(idempotencyKey || crypto.randomUUID());
  } else {
    headers['x-api-key'] = String(authKey || '').trim();
  }

  const form = new FormData();
  form.set('platform', platform);
  form.set('name', name);
  form.set('symbol', symbol);
  form.set('description', description);
  if (website) form.set('website', website);
  if (twitter) form.set('twitter', twitter);
  if (telegram) form.set('telegram', telegram);
  if (migrateType) form.set('migrateType', migrateType);
  form.set('cashbackEnabled', String(cashbackEnabled));
  form.set('devBuyEnabled', String(devBuyEnabled));
  if (devBuySol !== undefined) form.set('devBuySol', String(devBuySol));
  form.set('image', imageBlob, imageFilename);

  return fetchJson(`${normalizeBaseUrl(baseUrl)}/api/v1/token-builder/create`, {
    method: 'POST',
    headers,
    body: form
  });
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  console.log([
    'Import this file into your agent runtime and call:',
    '- callCortoSwap(...)',
    '- callCortoTransfer(...)',
    '- updateAgentPolicy(...)',
    '- callLightningTrade(...)',
    '- callTokenBuilderCreate(...)',
    '- callTokenBuilderClaim(...)'
  ].join('\n'));
}