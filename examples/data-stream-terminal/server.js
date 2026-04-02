// Path: examples/data-stream-terminal/server.js

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
const app = express();

const EXAMPLE_HOST = process.env.EXAMPLE_HOST || '127.0.0.1';
const EXAMPLE_PORT = Number.parseInt(process.env.EXAMPLE_PORT || '4010', 10);
const DATA_STREAM_WS_URL = process.env.DATA_STREAM_WS_URL || 'wss://corto.fun/data-stream';

app.disable('x-powered-by');
app.use(express.static(publicDir, {
  extensions: ['html'],
}));

app.get('/config.js', (_request, response) => {
  response.type('application/javascript; charset=utf-8');
  response.send(`window.CORTO_DATA_STREAM_TERMINAL_CONFIG = ${JSON.stringify({
    wsEndpoint: DATA_STREAM_WS_URL,
  }, null, 2)};`);
});

app.get('/health', (_request, response) => {
  response.json({
    ok: true,
    wsEndpoint: DATA_STREAM_WS_URL,
    host: EXAMPLE_HOST,
    port: EXAMPLE_PORT,
  });
});

app.get('/', (_request, response) => {
  response.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(EXAMPLE_PORT, EXAMPLE_HOST, () => {
  console.log(JSON.stringify({
    ok: true,
    host: EXAMPLE_HOST,
    port: EXAMPLE_PORT,
    wsEndpoint: DATA_STREAM_WS_URL,
  }, null, 2));
});
