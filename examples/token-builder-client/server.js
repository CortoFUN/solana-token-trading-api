// /examples/token-builder-client/server.js

import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { Blob } from 'node:buffer';
import { fileURLToPath } from 'node:url';

const CORTO_BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';
const CORTO_API_KEY = process.env.CORTO_API_KEY || '';
const WEB_PORT = Number(process.env.WEB_PORT || 3304);
const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1
  }
});

app.use(express.json({ limit: '256kb' }));
app.use(express.static(PUBLIC_DIR));

function createConfigError(message) {
  return {
    success: false,
    error: {
      code: 'TOKEN_BUILDER_EXAMPLE_CONFIG_ERROR',
      message
    }
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
          code: 'TOKEN_BUILDER_EXAMPLE_UPSTREAM_PARSE_ERROR',
          message: 'Upstream returned a non-JSON response.',
          raw: text.slice(0, 1000)
        }
      }
    };
  }
}

app.get('/api/runtime', async (_request, response) => {
  const capabilities = await fetchUpstream('/api/v1/token-builder/capabilities', { method: 'GET' });

  return response.json({
    success: true,
    runtime: {
      title: 'Corto.Fun Token Builder Example',
      baseUrl: CORTO_BASE_URL,
      port: WEB_PORT,
      hasApiKey: Boolean(CORTO_API_KEY)
    },
    capabilities: capabilities.body
  });
});

app.post('/api/create', upload.single('image'), async (request, response) => {
  if (!CORTO_API_KEY) {
    return response.status(400).json(createConfigError('Set CORTO_API_KEY in examples/token-builder-client/.env before creating tokens.'));
  }

  if (!request.file) {
    return response.status(400).json({
      success: false,
      error: {
        code: 'TOKEN_BUILDER_EXAMPLE_VALIDATION_ERROR',
        message: 'image is required'
      }
    });
  }

  try {
    const form = new FormData();
    for (const [key, value] of Object.entries(request.body || {})) {
      form.append(key, String(value ?? ''));
    }
    form.append('image', new Blob([request.file.buffer], { type: request.file.mimetype || 'application/octet-stream' }), request.file.originalname || 'token-image');

    const upstream = await fetchUpstream('/api/v1/token-builder/create', {
      method: 'POST',
      headers: {
        'x-api-key': CORTO_API_KEY
      },
      body: form
    });

    return response.status(upstream.status).json(upstream.body);
  } catch (error) {
    return response.status(500).json({
      success: false,
      error: {
        code: 'TOKEN_BUILDER_EXAMPLE_ERROR',
        message: error.message
      }
    });
  }
});

app.post('/api/claim', async (request, response) => {
  if (!CORTO_API_KEY) {
    return response.status(400).json(createConfigError('Set CORTO_API_KEY in examples/token-builder-client/.env before claiming rewards.'));
  }

  try {
    const upstream = await fetchUpstream('/api/v1/token-builder/claim-cashback', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': CORTO_API_KEY
      },
      body: JSON.stringify({
        platform: request.body?.platform || 'pump'
      })
    });

    return response.status(upstream.status).json(upstream.body);
  } catch (error) {
    return response.status(500).json({
      success: false,
      error: {
        code: 'TOKEN_BUILDER_EXAMPLE_ERROR',
        message: error.message
      }
    });
  }
});

app.listen(WEB_PORT, () => {
  console.log(`Token builder example is running at http://localhost:${WEB_PORT}`);
});