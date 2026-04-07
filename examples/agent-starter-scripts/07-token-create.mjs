// /examples/agent-starter-scripts/07-token-create.mjs

import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';

function inferImageMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  throw new Error('CORTO_TOKEN_IMAGE_PATH must point to a png, jpeg, or webp file');
}

function resolveExecutionAuth() {
  const executionKey = String(process.env.CORTO_AGENT_EXECUTION_KEY || '').trim();
  if (executionKey) {
    return {
      headers: {
        'x-agent-execution-key': executionKey,
        'x-idempotency-key': String(process.env.CORTO_IDEMPOTENCY_KEY || `token-create-${crypto.randomUUID()}`)
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

async function fetchJson(pathname, options) {
  const response = await fetch(`${BASE_URL}${pathname}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok || body?.success === false) {
    throw new Error(body?.error?.message || `HTTP ${response.status}`);
  }

  return body;
}

const imagePath = String(process.env.CORTO_TOKEN_IMAGE_PATH || '').trim();
const tokenName = String(process.env.CORTO_TOKEN_NAME || '').trim();
const tokenSymbol = String(process.env.CORTO_TOKEN_SYMBOL || '').trim();
const tokenDescription = String(process.env.CORTO_TOKEN_DESCRIPTION || '').trim();

if (!imagePath) {
  throw new Error('Missing CORTO_TOKEN_IMAGE_PATH');
}
if (!tokenName || !tokenSymbol || !tokenDescription) {
  throw new Error('Missing CORTO_TOKEN_NAME, CORTO_TOKEN_SYMBOL, or CORTO_TOKEN_DESCRIPTION');
}

const auth = resolveExecutionAuth();
const imageBytes = await readFile(imagePath);
const imageMimeType = inferImageMimeType(imagePath);
const form = new FormData();

form.set('platform', String(process.env.CORTO_TOKEN_PLATFORM || 'pump'));
form.set('name', tokenName);
form.set('symbol', tokenSymbol);
form.set('description', tokenDescription);
if (process.env.CORTO_TOKEN_WEBSITE) form.set('website', String(process.env.CORTO_TOKEN_WEBSITE));
if (process.env.CORTO_TOKEN_TWITTER) form.set('twitter', String(process.env.CORTO_TOKEN_TWITTER));
if (process.env.CORTO_TOKEN_TELEGRAM) form.set('telegram', String(process.env.CORTO_TOKEN_TELEGRAM));
if (process.env.CORTO_TOKEN_MIGRATE_TYPE) form.set('migrateType', String(process.env.CORTO_TOKEN_MIGRATE_TYPE));
form.set('cashbackEnabled', String(process.env.CORTO_TOKEN_CASHBACK_ENABLED || 'true'));
form.set('devBuyEnabled', String(process.env.CORTO_TOKEN_DEV_BUY_ENABLED || 'false'));
if (process.env.CORTO_TOKEN_DEV_BUY_SOL) form.set('devBuySol', String(process.env.CORTO_TOKEN_DEV_BUY_SOL));
form.set('image', new Blob([imageBytes], { type: imageMimeType }), path.basename(imagePath));

const result = await fetchJson('/api/v1/token-builder/create', {
  method: 'POST',
  headers: auth.headers,
  body: form
});

console.log(JSON.stringify({ mode: auth.mode, imagePath, result }, null, 2));