// /examples/human-starter-scripts/05-token-create.mjs

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';
const API_KEY = String(process.env.CORTO_API_KEY || '').trim();
const IMAGE_PATH = String(process.env.CORTO_TOKEN_IMAGE_PATH || '').trim();

function inferImageMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  throw new Error('CORTO_TOKEN_IMAGE_PATH must point to a png, jpeg, or webp file');
}

if (!API_KEY) throw new Error('Missing CORTO_API_KEY');
if (!IMAGE_PATH) throw new Error('Missing CORTO_TOKEN_IMAGE_PATH');

async function fetchJson(pathname, options) {
  const response = await fetch(`${BASE_URL}${pathname}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok || body?.success === false) {
    throw new Error(body?.error?.message || `HTTP ${response.status}`);
  }

  return body;
}

const imageBuffer = await readFile(IMAGE_PATH);
const imageName = path.basename(IMAGE_PATH);
const imageMimeType = inferImageMimeType(IMAGE_PATH);
const form = new FormData();

form.set('platform', String(process.env.CORTO_TOKEN_PLATFORM || 'pump'));
form.set('name', String(process.env.CORTO_TOKEN_NAME || '').trim());
form.set('symbol', String(process.env.CORTO_TOKEN_SYMBOL || '').trim());
form.set('description', String(process.env.CORTO_TOKEN_DESCRIPTION || '').trim());

const website = String(process.env.CORTO_TOKEN_WEBSITE || '').trim();
const twitter = String(process.env.CORTO_TOKEN_TWITTER || '').trim();
const telegram = String(process.env.CORTO_TOKEN_TELEGRAM || '').trim();
const migrateType = String(process.env.CORTO_TOKEN_MIGRATE_TYPE || '').trim();

if (website) form.set('website', website);
if (twitter) form.set('twitter', twitter);
if (telegram) form.set('telegram', telegram);
if (migrateType) form.set('migrateType', migrateType);

form.set('cashbackEnabled', String(process.env.CORTO_TOKEN_CASHBACK_ENABLED || 'true'));
form.set('devBuyEnabled', String(process.env.CORTO_TOKEN_DEV_BUY_ENABLED || 'false'));

const devBuySol = String(process.env.CORTO_TOKEN_DEV_BUY_SOL || '').trim();
if (devBuySol) {
  form.set('devBuySol', devBuySol);
}

form.set('image', new Blob([imageBuffer], { type: imageMimeType }), imageName);

const body = await fetchJson('/api/v1/token-builder/create', {
  method: 'POST',
  headers: {
    'x-api-key': API_KEY
  },
  body: form
});

console.log(JSON.stringify(body, null, 2));