// /examples/web-client/server.js

import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';

const CORTO_BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';
const CORTO_API_KEY = process.env.CORTO_API_KEY || '';
const DEFAULT_POOL = process.env.CORTO_DEFAULT_POOL || 'auto';
const WEB_PORT = Number(process.env.WEB_PORT || 3301);
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

function createConfigError(message) {
  return {
    success: false,
    error: {
      code: 'WEB_TOOL_CONFIG_ERROR',
      message
    }
  };
}

function normalizePayload(payload) {
  return {
    action: payload.action,
    mint: String(payload.mint || '').trim(),
    amount: typeof payload.amount === 'number' ? payload.amount : String(payload.amount || '').trim(),
    denominatedInSol: normalizeBoolean(payload.denominatedInSol, false),
    slippage: Number(payload.slippage || 5),
    pool: payload.pool || DEFAULT_POOL,
    priorityFeeSol: payload.priorityFeeSol ?? undefined,
    jitoTip: payload.jitoTip ?? undefined,
    memo: normalizeOptionalText(payload.memo),
    ackMode: 'confirmed',
    maxRouteMs: 1200
  };
}

function validateTradePayload(payload) {
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
          code: 'WEB_TOOL_UPSTREAM_PARSE_ERROR',
          message: 'Upstream returned a non-JSON response.',
          raw: text.slice(0, 1000)
        }
      }
    };
  }
}

app.get('/api/runtime', async (_request, response) => {
  const capabilities = await fetchUpstream('/api/v1/lightning/capabilities', { method: 'GET' });

  return response.json({
    success: true,
    runtime: {
      title: 'Corto.Fun Web Buy / Sell Console',
      defaultPool: DEFAULT_POOL,
      hasApiKey: Boolean(CORTO_API_KEY),
      baseUrl: CORTO_BASE_URL,
      port: WEB_PORT
    },
    capabilities: capabilities.body
  });
});

app.post('/api/trade', async (request, response) => {
  if (!CORTO_API_KEY) {
    return response.status(400).json(createConfigError('Set CORTO_API_KEY in examples/web-client/.env before sending trades.'));
  }

  try {
    const payload = normalizePayload(request.body || {});
    const validationError = validateTradePayload(payload);

    if (validationError) {
      return response.status(400).json({
        success: false,
        error: {
          code: 'WEB_TOOL_VALIDATION_ERROR',
          message: validationError
        }
      });
    }

    const upstream = await fetchUpstream('/api/v1/lightning/trade', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': CORTO_API_KEY
      },
      body: JSON.stringify(payload)
    });

    return response.status(upstream.status).json(upstream.body);
  } catch (error) {
    return response.status(500).json({
      success: false,
      error: {
        code: 'WEB_TOOL_ERROR',
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
        code: 'WEB_TOOL_STATUS_ERROR',
        message: error.message
      }
    });
  }
});

app.listen(WEB_PORT, () => {
  console.log(`Web client example is running at http://localhost:${WEB_PORT}`);
});