// /examples/human-starter-scripts/08-openai-claude-user-wallet-example.mjs

const DEFAULT_BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function createApiHeaders(apiKey, contentType = 'application/json') {
  const normalizedKey = String(apiKey || '').trim();
  if (!normalizedKey) {
    throw new Error('apiKey is required');
  }

  return contentType
    ? { 'content-type': contentType, 'x-api-key': normalizedKey }
    : { 'x-api-key': normalizedKey };
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

export async function verifyCortoApiKey({ baseUrl = DEFAULT_BASE_URL, apiKey }) {
  return fetchJson(`${normalizeBaseUrl(baseUrl)}/api/v1/verify`, {
    method: 'POST',
    headers: createApiHeaders(apiKey, null)
  });
}

export async function callCortoLightningTrade({ baseUrl = DEFAULT_BASE_URL, apiKey, action, mint, amount, denominatedInSol = false, slippage = 5, pool = 'auto', ackMode = 'confirmed', memo = 'AI agent human-wallet lightning trade', maxRouteMs = 1200, priorityFeeSol, jitoTipSol }) {
  return fetchJson(`${normalizeBaseUrl(baseUrl)}/api/v1/lightning/trade`, {
    method: 'POST',
    headers: createApiHeaders(apiKey),
    body: JSON.stringify({ action, mint, amount, denominatedInSol, slippage, pool, ackMode, memo, maxRouteMs, priorityFeeSol, jitoTipSol })
  });
}

export async function callCortoSwap({ baseUrl = DEFAULT_BASE_URL, apiKey, inputMint, outputMint, amount, slippage = 10, pool = 'jupiter', ackMode = 'confirmed', memo = 'AI agent human-wallet swap', priorityFeeSol = 0.0003, maxRouteMs = 8000 }) {
  return fetchJson(`${normalizeBaseUrl(baseUrl)}/api/v1/swap/execute`, {
    method: 'POST',
    headers: createApiHeaders(apiKey),
    body: JSON.stringify({ inputMint, outputMint, amount, slippage, pool, ackMode, memo, priorityFeeSol, maxRouteMs })
  });
}

export async function callTokenBuilderClaim({ baseUrl = DEFAULT_BASE_URL, apiKey, platform = 'pump' }) {
  return fetchJson(`${normalizeBaseUrl(baseUrl)}/api/v1/token-builder/claim-cashback`, {
    method: 'POST',
    headers: createApiHeaders(apiKey),
    body: JSON.stringify({ platform })
  });
}

export async function callTokenBuilderCreate({ baseUrl = DEFAULT_BASE_URL, apiKey, imageBlob, imageFilename = 'token-image.png', platform = 'pump', name, symbol, description, website, twitter, telegram, migrateType, cashbackEnabled = true, devBuyEnabled = false, devBuySol }) {
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
    headers: createApiHeaders(apiKey, null),
    body: form
  });
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  console.log([
    'Import this file into your agent/runtime and call:',
    '- verifyCortoApiKey(...)',
    '- callCortoLightningTrade(...)',
    '- callCortoSwap(...)',
    '- callTokenBuilderCreate(...)',
    '- callTokenBuilderClaim(...)'
  ].join('\n'));
}