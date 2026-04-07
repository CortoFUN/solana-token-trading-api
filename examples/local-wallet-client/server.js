// /examples/local-wallet-client/server.js

import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';

const LOCAL_WALLET_PORT = Number(process.env.LOCAL_WALLET_PORT || 3302);
const CORTO_BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';
const DEFAULT_POOL = process.env.CORTO_DEFAULT_POOL || 'auto';
const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));

const app = express();

app.use(express.json({ limit: '256kb' }));
app.use(express.static(PUBLIC_DIR));

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function normalizeOptionalText(value) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function normalizePayload(payload) {
  return {
    publicKey: String(payload.publicKey || '').trim(),
    action: payload.action,
    mint: String(payload.mint || '').trim(),
    amount: typeof payload.amount === 'number' ? payload.amount : String(payload.amount || '').trim(),
    denominatedInSol: normalizeBoolean(payload.denominatedInSol, false),
    slippage: Number(payload.slippage || 5),
    pool: payload.pool || DEFAULT_POOL,
    priorityFeeSol: payload.priorityFeeSol ?? undefined,
    memo: normalizeOptionalText(payload.memo)
  };
}

function validateBuildPayload(payload) {
  if (!payload.publicKey) {
    return 'Field "publicKey" is required.';
  }

  if (!['buy', 'sell'].includes(payload.action)) {
    return 'Field "action" must be either "buy" or "sell".';
  }

  if (!payload.mint) {
    return 'Field "mint" is required.';
  }

  if (payload.amount === '' || payload.amount === undefined || payload.amount === null) {
    return 'Field "amount" is required.';
  }

  if (!Number.isFinite(payload.slippage) || payload.slippage <= 0) {
    return 'Field "slippage" must be a positive number.';
  }

  return null;
}

async function fetchUpstream(path, options) {
  const upstream = await fetch(`${CORTO_BASE_URL}${path}`, options);
  const text = await upstream.text();

  try {
    return {
      status: upstream.status,
      body: text ? JSON.parse(text) : {}
    };
  } catch {
    return {
      status: upstream.status,
      body: {
        success: false,
        error: {
          code: 'LOCAL_WALLET_UPSTREAM_PARSE_ERROR',
          message: 'Upstream returned a non-JSON response.',
          raw: text.slice(0, 1000)
        }
      }
    };
  }
}

app.get('/api/runtime', async (_request, response) => {
  const capabilities = await fetchUpstream('/api/v1/local/capabilities', { method: 'GET' });

  return response.json({
    success: true,
    runtime: {
      title: 'Corto.Fun Local Phantom Trade Tool',
      defaultPool: DEFAULT_POOL,
      baseUrl: CORTO_BASE_URL,
      port: LOCAL_WALLET_PORT
    },
    capabilities: capabilities.body
  });
});

app.post('/api/build-trade', async (request, response) => {
  try {
    const payload = normalizePayload(request.body || {});
    const validationError = validateBuildPayload(payload);

    if (validationError) {
      return response.status(400).json({
        success: false,
        error: {
          code: 'LOCAL_WALLET_VALIDATION_ERROR',
          message: validationError
        }
      });
    }

    const upstream = await fetchUpstream('/api/v1/local/trade', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    return response.status(upstream.status).json(upstream.body);
  } catch (error) {
    return response.status(500).json({
      success: false,
      error: {
        code: 'LOCAL_WALLET_BUILD_ERROR',
        message: error.message
      }
    });
  }
});

app.get('/api/status/:signature', async (request, response) => {
  try {
    const upstream = await fetchUpstream(`/api/v1/tx/${encodeURIComponent(request.params.signature)}/status`, {
      method: 'GET'
    });
    return response.status(upstream.status).json(upstream.body);
  } catch (error) {
    return response.status(500).json({
      success: false,
      error: {
        code: 'LOCAL_WALLET_STATUS_ERROR',
        message: error.message
      }
    });
  }
});

app.listen(LOCAL_WALLET_PORT, () => {
  console.log(`Local wallet tool example is running at http://localhost:${LOCAL_WALLET_PORT}`);
});