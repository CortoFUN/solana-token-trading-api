// /examples/dev-analytics-board/server.js

import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';

const DEV_ANALYTICS_PORT = Number(process.env.DEV_ANALYTICS_PORT || 3303);
const CORTO_BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';
const CORTO_API_KEY = process.env.CORTO_API_KEY || '';
const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));

const app = express();

app.use(express.json({ limit: '256kb' }));
app.use(express.static(PUBLIC_DIR));

function createConfigError(message) {
  return {
    success: false,
    error: {
      code: 'DEV_ANALYTICS_CONFIG_ERROR',
      message
    }
  };
}

function normalizePayload(payload) {
  const normalized = {
    frame: String(payload.frame || '').trim(),
    partnerAddress: String(payload.partnerAddress || '').trim(),
    projectId: String(payload.projectId || '').trim(),
    userWallet: String(payload.userWallet || '').trim()
  };

  return Object.fromEntries(Object.entries(normalized).filter(([, value]) => value));
}

function validatePayload(payload) {
  if (!payload.frame) {
    return 'Field "frame" is required.';
  }

  if (!/^(?:([1-9]|1\d|2[0-4])h|([1-9]|[12]\d|30)d)$/.test(payload.frame)) {
    return 'Field "frame" must be 1..24h or 1..30d, for example 7h or 12d.';
  }

  if (!payload.partnerAddress) {
    return 'Field "partnerAddress" is required and must match the wallet restored from this API key.';
  }

  return null;
}

async function fetchApiKeyOwner() {
  if (!CORTO_API_KEY) {
    return {
      hasApiKey: false,
      ownerPublicKey: null,
      apiKeyVersion: null,
      verifyError: null
    };
  }

  const upstream = await fetchUpstream('/api/v1/verify', {
    method: 'POST',
    headers: {
      'x-api-key': CORTO_API_KEY
    }
  });

  if (upstream.status >= 400 || upstream.body?.success === false) {
    return {
      hasApiKey: true,
      ownerPublicKey: null,
      apiKeyVersion: null,
      verifyError: upstream.body?.error?.message || `HTTP ${upstream.status}`
    };
  }

  return {
    hasApiKey: true,
    ownerPublicKey: String(upstream.body?.publicKey || '').trim() || null,
    apiKeyVersion: upstream.body?.apiKeyVersion || null,
    verifyError: null
  };
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
          code: 'DEV_ANALYTICS_UPSTREAM_PARSE_ERROR',
          message: 'Upstream returned a non-JSON response.',
          raw: text.slice(0, 1000)
        }
      }
    };
  }
}

app.get('/api/runtime', async (_request, response) => {
  const owner = await fetchApiKeyOwner();

  return response.json({
    success: true,
    runtime: {
      title: 'Corto.Fun Developer Analytics Board',
      baseUrl: CORTO_BASE_URL,
      port: DEV_ANALYTICS_PORT,
      hasApiKey: owner.hasApiKey,
      ownerPublicKey: owner.ownerPublicKey,
      apiKeyVersion: owner.apiKeyVersion,
      verifyError: owner.verifyError,
      canQueryAnalytics: Boolean(owner.ownerPublicKey)
    }
  });
});

app.post('/api/analytics', async (request, response) => {
  if (!CORTO_API_KEY) {
    return response.status(400).json(createConfigError('Set CORTO_API_KEY in examples/dev-analytics-board/.env before querying analytics.'));
  }

  try {
    const owner = await fetchApiKeyOwner();
    if (!owner.ownerPublicKey) {
      return response.status(400).json(createConfigError(owner.verifyError || 'Configured CORTO_API_KEY could not be verified.'));
    }

    const payload = normalizePayload(request.body || {});
    const validationError = validatePayload(payload);

    if (validationError) {
      return response.status(400).json({
        success: false,
        error: {
          code: 'DEV_ANALYTICS_VALIDATION_ERROR',
          message: validationError
        }
      });
    }

    if (payload.partnerAddress !== owner.ownerPublicKey) {
      return response.status(403).json({
        success: false,
        error: {
          code: 'DEV_ANALYTICS_PARTNER_MISMATCH',
          message: 'partnerAddress must match the public key restored from the configured API key.'
        }
      });
    }

    const upstream = await fetchUpstream('/api/v1/dev/analytics/trades', {
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
        code: 'DEV_ANALYTICS_ERROR',
        message: error.message
      }
    });
  }
});

app.listen(DEV_ANALYTICS_PORT, () => {
  console.log(`Developer analytics board is running at http://localhost:${DEV_ANALYTICS_PORT}`);
});