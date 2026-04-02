// /examples/trading-terminal-v1/server.js

import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { Blob } from 'node:buffer';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import wsPackage from 'ws';
import { ALLOWED_POOL_SLUGS } from '../../src/router/pool.catalog.js';

const WebSocket = wsPackage;
const WebSocketServer = wsPackage.Server;

const CORTO_BASE_URL = process.env.CORTO_BASE_URL || 'https://corto.fun';
const CORTO_WS_URL = process.env.CORTO_WS_URL || 'wss://corto.fun/data-stream';
const DEFAULT_POOL = process.env.CORTO_DEFAULT_POOL || 'auto';
const WEB_PORT = Number(process.env.WEB_PORT || 3305);
const STREAM_CACHE_LIMIT = 5000;
const STREAM_CACHE_TTL_MS = 60 * 60 * 1000;
const STREAM_COLUMN_LIMIT = 140;
const TOKEN_SIGNATURE_LIMIT = 48;
const SOL_PRICE_REFRESH_MS = 2 * 60 * 1000;
const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));

const app = express();
const server = createServer(app);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1
  }
});

const streamState = {
  socket: null,
  socketState: 'offline',
  statusText: 'Waiting for stream connection.',
  isManuallyClosed: false,
  reconnectTimer: null,
  tokenCache: new Map(),
  createOrder: [],
  nearFillOrder: [],
  migrationOrder: [],
  clients: new Set(),
  broadcastTimer: null,
  lastUpdateAt: 0,
  solPriceUsd: null,
  solPriceUpdatedAt: 0
};

app.use(express.json({ limit: '512kb' }));
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

function normalizePool(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRequestedTradePool(value, fallback = DEFAULT_POOL) {
  const pool = normalizePool(value);
  const fallbackPool = normalizePool(fallback) || 'auto';

  if (!pool) {
    return fallbackPool;
  }

  if (ALLOWED_POOL_SLUGS.includes(pool)) {
    return pool;
  }

  if (pool === 'pump.fun' || pool === 'pump-fun' || pool.startsWith('pump-')) {
    return 'pump';
  }

  if (pool.includes('raydium-launchlab')) {
    return 'raydium-launchlab';
  }

  if (pool.startsWith('raydium-')) {
    return 'raydium';
  }

  if (pool === 'meteora-dbc') {
    return 'meteora-dbc';
  }

  if (pool.startsWith('meteora-dlmm')) {
    return 'meteora-dlmm';
  }

  if (pool.startsWith('meteora-damm-v2')) {
    return 'meteora-damm-v2';
  }

  if (pool.startsWith('meteora-damm') || pool.startsWith('meteora-amm')) {
    return 'meteora-amm';
  }

  if (pool.startsWith('meteora-')) {
    return 'meteora';
  }

  return fallbackPool;
}

function mapPoolToLaunchpad(value) {
  const pool = normalizePool(value);

  if (!pool) {
    return null;
  }

  if (pool.includes('letsbonk')) {
    return 'letsbonk.fun';
  }

  if (pool.includes('raydium-launchlab') || pool.startsWith('raydium-')) {
    return 'raydium-launchlab';
  }

  if (pool.includes('meteora-dbc') || pool.startsWith('meteora-')) {
    return 'meteora-dbc';
  }

  if (pool === 'pump.fun' || pool === 'pump' || pool === 'pump-fun' || pool.startsWith('pump-')) {
    return 'pump.fun';
  }

  return null;
}

function getOptionalUserApiKey(request) {
  return normalizeOptionalText(request.get('x-corto-user-api-key'));
}

function createConfigError(message) {
  return {
    success: false,
    error: {
      code: 'TRADING_TERMINAL_V1_CONFIG_ERROR',
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
          code: 'TRADING_TERMINAL_V1_UPSTREAM_PARSE_ERROR',
          message: 'Upstream returned a non-JSON response.',
          raw: text.slice(0, 1000)
        }
      }
    };
  }
}

async function refreshSolPriceUsd() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const nextPrice = normalizeFiniteNumber(payload?.solana?.usd);

    if (nextPrice !== null && nextPrice > 0) {
      streamState.solPriceUsd = nextPrice;
      streamState.solPriceUpdatedAt = Date.now();
    }
  } catch {
    return;
  }
}

function normalizeTradePayload(payload) {
  return {
    action: payload.action,
    mint: String(payload.mint || '').trim(),
    amount: typeof payload.amount === 'number' ? payload.amount : String(payload.amount || '').trim(),
    denominatedInSol: normalizeBoolean(payload.denominatedInSol, false),
    slippage: Number(payload.slippage || 5),
    pool: 'auto',
    priorityFeeSol: payload.priorityFeeSol ?? undefined,
    jitoTip: payload.jitoTip ?? undefined,
    publicKey: normalizeOptionalText(payload.publicKey),
    memo: normalizeOptionalText(payload.memo)
  };
}

function validateTradePayload(payload, { requirePublicKey = false } = {}) {
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

  if (requirePublicKey && !payload.publicKey) {
    return 'Field "publicKey" is required for local build mode.';
  }

  return null;
}

function extractEventPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (payload.event && typeof payload.event === 'object') {
    return payload.event;
  }

  if (payload.data && typeof payload.data === 'object' && (payload.data.txType || payload.data.mint)) {
    return payload.data;
  }

  return payload;
}

function normalizeText(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeFiniteNumber(value) {
  if (value === '' || value === undefined || value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickLastNonEmpty(...values) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeText(values[index]);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function pickLastFinite(...values) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeFiniteNumber(values[index]);
    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

function deriveImageUrl(payload) {
  return pickLastNonEmpty(payload?.imageUrl, payload?.image, payload?.imageURI, payload?.imageUri);
}

function deriveLaunchpad(payload) {
  return pickLastNonEmpty(
    payload?.launchpad,
    payload?.launchpadBrand,
    payload?.brand,
    mapPoolToLaunchpad(payload?.pool)
  );
}

function shortenMint(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length <= 12) {
    return normalized;
  }

  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

function deriveDisplayName(item) {
  return pickLastNonEmpty(item?.name, item?.symbol);
}

function deriveDisplaySymbol(item) {
  return pickLastNonEmpty(item?.symbol);
}

function deriveDisplayLaunchpad(item) {
  return pickLastNonEmpty(item?.launchpad, mapPoolToLaunchpad(item?.pool));
}

function hasStreamDisplaySeed(item) {
  return Boolean(pickLastNonEmpty(item?.name, item?.symbol)) && Boolean(deriveDisplayLaunchpad(item));
}

function isRenderableStreamToken(item) {
  return Boolean(item && hasStreamDisplaySeed(item));
}

function deriveTimestampMs(payload) {
  return pickLastFinite(
    payload?.timestampMs,
    payload?.timestamp,
    payload?.createdAtMs,
    payload?.createdAt,
    payload?.time,
    Date.now()
  );
}

function deriveVolumeSol(payload) {
  return pickLastFinite(payload?.solAmount, payload?.amountSol, payload?.volumeSol);
}

function trimSignatureHistory(history) {
  if (!Array.isArray(history) || history.length <= TOKEN_SIGNATURE_LIMIT) {
    return history;
  }

  return history.slice(history.length - TOKEN_SIGNATURE_LIMIT);
}

function hasSeenSignature(item, signature) {
  if (!signature) {
    return false;
  }

  return Array.isArray(item.signatureHistory) && item.signatureHistory.includes(signature);
}

function pushSignature(item, signature) {
  if (!signature) {
    return trimSignatureHistory(item.signatureHistory || []);
  }

  const nextHistory = Array.isArray(item.signatureHistory)
    ? item.signatureHistory.filter((entry) => entry !== signature)
    : [];

  nextHistory.push(signature);
  return trimSignatureHistory(nextHistory);
}

function ensureOrder(order, mint) {
  if (!mint || order.includes(mint)) {
    return;
  }

  order.push(mint);
}

function removeFromOrder(order, mint) {
  const index = order.indexOf(mint);
  if (index >= 0) {
    order.splice(index, 1);
  }
}

function removeStreamToken(mint) {
  if (!mint || !streamState.tokenCache.has(mint)) {
    return;
  }

  streamState.tokenCache.delete(mint);
  removeFromOrder(streamState.createOrder, mint);
  removeFromOrder(streamState.nearFillOrder, mint);
  removeFromOrder(streamState.migrationOrder, mint);
}

function trimStreamCache() {
  const now = Date.now();

  [...streamState.tokenCache.values()].forEach((item) => {
    if ((item.lastSeenAt || 0) + STREAM_CACHE_TTL_MS < now) {
      removeStreamToken(item.mint);
    }
  });

  if (streamState.tokenCache.size <= STREAM_CACHE_LIMIT) {
    return;
  }

  const oldest = [...streamState.tokenCache.values()]
    .sort((left, right) => (left.lastSeenAt || 0) - (right.lastSeenAt || 0))
    .slice(0, streamState.tokenCache.size - STREAM_CACHE_LIMIT);

  oldest.forEach((item) => {
    removeStreamToken(item.mint);
  });
}

function upsertStreamToken(mint, patch) {
  const normalizedMint = normalizeText(mint);
  if (!normalizedMint) {
    return;
  }

  const existing = streamState.tokenCache.get(normalizedMint) || {
    mint: normalizedMint,
    createSeen: false,
    migrationSeen: false,
    lastSeenAt: 0,
    launchpad: null,
    buyCount: 0,
    sellCount: 0,
    tradeCount: 0,
    volumeSol: 0,
    signatureHistory: []
  };

  const pool = pickLastNonEmpty(existing.pool, patch.pool);
  const launchpad = pickLastNonEmpty(existing.launchpad, patch.launchpad, mapPoolToLaunchpad(pool));
  const signature = pickLastNonEmpty(existing.signature, patch.signature);

  const next = {
    ...existing,
    ...patch,
    mint: normalizedMint,
    name: pickLastNonEmpty(existing.name, patch.name),
    symbol: pickLastNonEmpty(existing.symbol, patch.symbol),
    pool,
    launchpad,
    imageUrl: pickLastNonEmpty(existing.imageUrl, patch.imageUrl),
    metadataUri: pickLastNonEmpty(existing.metadataUri, patch.metadataUri),
    marketCapSol: pickLastFinite(existing.marketCapSol, patch.marketCapSol),
    appRiskScorePercent: pickLastFinite(existing.appRiskScorePercent, patch.appRiskScorePercent),
    riskLevel: pickLastNonEmpty(existing.riskLevel, patch.riskLevel),
    bondingCurveProgress: pickLastFinite(existing.bondingCurveProgress, patch.bondingCurveProgress),
    signature,
    lastEventType: pickLastNonEmpty(existing.lastEventType, patch.lastEventType),
    createdAtMs: pickLastFinite(existing.createdAtMs, patch.createdAtMs),
    buyCount: Number.isFinite(Number(patch.buyCount)) ? Number(patch.buyCount) : Number(existing.buyCount || 0),
    sellCount: Number.isFinite(Number(patch.sellCount)) ? Number(patch.sellCount) : Number(existing.sellCount || 0),
    tradeCount: Number.isFinite(Number(patch.tradeCount)) ? Number(patch.tradeCount) : Number(existing.tradeCount || 0),
    volumeSol: Number.isFinite(Number(patch.volumeSol)) ? Number(patch.volumeSol) : Number(existing.volumeSol || 0),
    signatureHistory: Array.isArray(patch.signatureHistory) ? patch.signatureHistory : existing.signatureHistory,
    lastSeenAt: Date.now()
  };

  streamState.tokenCache.set(normalizedMint, next);

  if (next.createSeen) {
    ensureOrder(streamState.createOrder, normalizedMint);
  }

  if (Number.isFinite(Number(next.bondingCurveProgress)) && Number(next.bondingCurveProgress) >= 95) {
    ensureOrder(streamState.nearFillOrder, normalizedMint);
  } else {
    removeFromOrder(streamState.nearFillOrder, normalizedMint);
  }

  if (next.migrationSeen) {
    ensureOrder(streamState.migrationOrder, normalizedMint);
  }

  trimStreamCache();
}

function handleCreateEvent(eventPayload) {
  const mint = normalizeText(eventPayload?.mint);
  if (!mint) {
    return;
  }

  upsertStreamToken(mint, {
    createSeen: true,
    name: pickLastNonEmpty(eventPayload.name, eventPayload.tokenName),
    symbol: pickLastNonEmpty(eventPayload.symbol, eventPayload.tokenSymbol),
    pool: normalizeText(eventPayload.pool),
    launchpad: deriveLaunchpad(eventPayload),
    imageUrl: deriveImageUrl(eventPayload),
    metadataUri: pickLastNonEmpty(eventPayload.uri, eventPayload.metadataUri),
    marketCapSol: normalizeFiniteNumber(eventPayload.marketCapSol),
    appRiskScorePercent: normalizeFiniteNumber(eventPayload.appRiskScorePercent),
    riskLevel: normalizeText(eventPayload.riskLevel),
    bondingCurveProgress: normalizeFiniteNumber(eventPayload.bondingCurveProgress),
    signature: normalizeText(eventPayload.signature),
    createdAtMs: deriveTimestampMs(eventPayload),
    lastEventType: 'create'
  });
}

function handleTradeEvent(eventPayload) {
  const mint = normalizeText(eventPayload?.mint);
  if (!mint) {
    return;
  }

  const existing = streamState.tokenCache.get(mint) || {
    buyCount: 0,
    sellCount: 0,
    tradeCount: 0,
    volumeSol: 0,
    signatureHistory: []
  };
  const signature = normalizeText(eventPayload.signature);

  if (hasSeenSignature(existing, signature)) {
    upsertStreamToken(mint, {
      pool: normalizeText(eventPayload.pool),
      launchpad: deriveLaunchpad(eventPayload),
      marketCapSol: normalizeFiniteNumber(eventPayload.marketCapSol),
      bondingCurveProgress: normalizeFiniteNumber(eventPayload.bondingCurveProgress),
      lastEventType: normalizeText(eventPayload.txType) || 'trade'
    });
    return;
  }

  const eventType = String(eventPayload.txType || 'trade').toLowerCase();
  const nextBuyCount = Number(existing.buyCount || 0) + (eventType === 'buy' ? 1 : 0);
  const nextSellCount = Number(existing.sellCount || 0) + (eventType === 'sell' ? 1 : 0);
  const nextTradeCount = Number(existing.tradeCount || 0) + 1;
  const nextVolumeSol = Number(existing.volumeSol || 0) + Number(deriveVolumeSol(eventPayload) || 0);

  upsertStreamToken(mint, {
    name: pickLastNonEmpty(eventPayload.name, eventPayload.tokenName),
    symbol: pickLastNonEmpty(eventPayload.symbol, eventPayload.tokenSymbol),
    pool: normalizeText(eventPayload.pool),
    launchpad: deriveLaunchpad(eventPayload),
    imageUrl: deriveImageUrl(eventPayload),
    metadataUri: pickLastNonEmpty(eventPayload.uri, eventPayload.metadataUri),
    marketCapSol: normalizeFiniteNumber(eventPayload.marketCapSol),
    appRiskScorePercent: normalizeFiniteNumber(eventPayload.appRiskScorePercent),
    riskLevel: normalizeText(eventPayload.riskLevel),
    bondingCurveProgress: normalizeFiniteNumber(eventPayload.bondingCurveProgress),
    signature,
    signatureHistory: pushSignature(existing, signature),
    buyCount: nextBuyCount,
    sellCount: nextSellCount,
    tradeCount: nextTradeCount,
    volumeSol: nextVolumeSol,
    lastEventType: eventType
  });
}

function handleMigrationEvent(eventPayload) {
  const mint = normalizeText(eventPayload?.mint);
  if (!mint) {
    return;
  }

  const existing = streamState.tokenCache.get(mint);
  if (!existing || !hasStreamDisplaySeed(existing)) {
    return;
  }

  upsertStreamToken(mint, {
    migrationSeen: true,
    name: pickLastNonEmpty(eventPayload.name, eventPayload.tokenName),
    symbol: pickLastNonEmpty(eventPayload.symbol, eventPayload.tokenSymbol),
    pool: normalizeText(eventPayload.pool),
    launchpad: deriveLaunchpad(eventPayload),
    imageUrl: deriveImageUrl(eventPayload),
    metadataUri: pickLastNonEmpty(eventPayload.uri, eventPayload.metadataUri),
    marketCapSol: normalizeFiniteNumber(eventPayload.marketCapSol),
    bondingCurveProgress: normalizeFiniteNumber(eventPayload.bondingCurveProgress),
    signature: normalizeText(eventPayload.signature),
    lastEventType: 'migration'
  });
}

function serializeToken(item) {
  const marketCapSol = item.marketCapSol ?? null;
  const marketCapUsd = item.marketCapUsd ?? (marketCapSol !== null && streamState.solPriceUsd !== null
    ? marketCapSol * streamState.solPriceUsd
    : null);
  const displayName = deriveDisplayName(item);
  const displaySymbol = deriveDisplaySymbol(item);
  const displayLaunchpad = deriveDisplayLaunchpad(item);

  return {
    mint: item.mint,
    name: item.name || '',
    symbol: item.symbol || '',
    pool: item.pool || '',
    launchpad: item.launchpad || '',
    imageUrl: item.imageUrl || '',
    displayName,
    displaySymbol,
    displayLaunchpad,
    marketCapSol,
    marketCapUsd,
    appRiskScorePercent: item.appRiskScorePercent ?? null,
    riskLevel: item.riskLevel || '',
    bondingCurveProgress: item.bondingCurveProgress ?? null,
    volumeSol: item.volumeSol ?? 0,
    buyCount: item.buyCount ?? 0,
    sellCount: item.sellCount ?? 0,
    tradeCount: item.tradeCount ?? 0,
    txCount: item.tradeCount ?? 0,
    signature: item.signature || '',
    lastEventType: item.lastEventType || '',
    lastSeenAt: item.lastSeenAt || 0
  };
}

function itemsFromOrder(order) {
  return order
    .map((mint) => streamState.tokenCache.get(mint))
    .filter(isRenderableStreamToken)
    .slice(-STREAM_COLUMN_LIMIT)
    .map(serializeToken);
}

function nearFillItemsFromOrder(order) {
  return order
    .map((mint) => streamState.tokenCache.get(mint))
    .filter((item) => isRenderableStreamToken(item) && !item.migrationSeen)
    .slice(-STREAM_COLUMN_LIMIT)
    .map(serializeToken);
}

function buildStreamSnapshot() {
  trimStreamCache();

  const creates = itemsFromOrder(streamState.createOrder);
  const nearFill = nearFillItemsFromOrder(streamState.nearFillOrder);
  const migrations = itemsFromOrder(streamState.migrationOrder);
  const itemIndex = new Map();

  [...creates, ...nearFill, ...migrations].forEach((item) => {
    itemIndex.set(item.mint, item);
  });

  return {
    success: true,
    socketState: streamState.socketState,
    statusText: streamState.statusText,
    lastUpdateAt: streamState.lastUpdateAt,
    pricing: {
      solPriceUsd: streamState.solPriceUsd,
      solPriceUpdatedAt: streamState.solPriceUpdatedAt
    },
    counts: {
      creates: creates.length,
      nearFill: nearFill.length,
      migrations: migrations.length
    },
    columns: {
      creates,
      nearFill,
      migrations
    },
    items: [...itemIndex.values()]
  };
}

function broadcastMessage(message) {
  const payload = JSON.stringify(message);

  streamState.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      return;
    }

    streamState.clients.delete(client);
  });
}

function broadcastSnapshot() {
  streamState.broadcastTimer = null;
  const snapshot = buildStreamSnapshot();
  broadcastMessage({ type: 'snapshot', payload: snapshot });
}

function scheduleBroadcast() {
  streamState.lastUpdateAt = Date.now();

  if (streamState.broadcastTimer) {
    return;
  }

  streamState.broadcastTimer = setTimeout(broadcastSnapshot, 40);
}

function updateStreamStatus(statusText, socketState = streamState.socketState) {
  streamState.statusText = statusText;
  streamState.socketState = socketState;
  scheduleBroadcast();
}

function clearReconnectTimer() {
  if (streamState.reconnectTimer) {
    clearTimeout(streamState.reconnectTimer);
    streamState.reconnectTimer = null;
  }
}

function processUpstreamMessage(rawData) {
  let payload;

  try {
    payload = JSON.parse(rawData);
  } catch {
    return;
  }

  if (!payload || typeof payload !== 'object') {
    return;
  }

  const serviceType = String(payload?.type === 'service' ? payload?.name : payload?.type || '').toLowerCase();

  if (['handshake', 'subscription_ack', 'current_state'].includes(serviceType)) {
    updateStreamStatus('Live stream connected and filtering launchpads.', 'online');
    return;
  }

  if (serviceType === 'error') {
    updateStreamStatus(payload?.error?.message || 'Upstream stream returned an error.', 'error');
    return;
  }

  const eventPayload = extractEventPayload(payload);
  if (!eventPayload || typeof eventPayload !== 'object') {
    return;
  }

  const eventType = String(eventPayload?.txType || eventPayload?.type || eventPayload?.eventType || '').toLowerCase();

  if (eventType === 'create') {
    handleCreateEvent(eventPayload);
  } else if (['buy', 'sell', 'trade'].includes(eventType)) {
    handleTradeEvent(eventPayload);
  } else if (eventType.includes('migration') || eventType === 'migrate') {
    handleMigrationEvent(eventPayload);
  } else {
    return;
  }

  scheduleBroadcast();
}

function sendUpstreamSubscription() {
  if (!streamState.socket || streamState.socket.readyState !== WebSocket.OPEN) {
    return;
  }

  streamState.socket.send(JSON.stringify({
    type: 'subscribe',
    mode: 'all',
    create: {
      detail: 'full'
    }
  }));
}

function scheduleReconnect() {
  clearReconnectTimer();

  if (streamState.isManuallyClosed) {
    return;
  }

  streamState.reconnectTimer = setTimeout(() => {
    connectUpstreamStream();
  }, 1800);
}

function connectUpstreamStream() {
  clearReconnectTimer();

  if (streamState.socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(streamState.socket.readyState)) {
    return;
  }

  streamState.isManuallyClosed = false;
  updateStreamStatus('Connecting relay to Corto launchpad stream...', 'connecting');
  streamState.socket = new WebSocket(CORTO_WS_URL);

  streamState.socket.addEventListener('open', () => {
    updateStreamStatus('Relay connected. Waiting for launchpad flow...', 'online');
    sendUpstreamSubscription();
  });

  streamState.socket.addEventListener('message', (event) => {
    processUpstreamMessage(event.data);
  });

  streamState.socket.addEventListener('error', () => {
    updateStreamStatus('Relay stream error. Reconnecting automatically...', 'error');
  });

  streamState.socket.addEventListener('close', () => {
    streamState.socket = null;
    updateStreamStatus(streamState.isManuallyClosed ? 'Stream disconnected.' : 'Relay stream closed. Reconnecting automatically...', streamState.isManuallyClosed ? 'offline' : 'error');
    scheduleReconnect();
  });
}

function disconnectUpstreamStream() {
  streamState.isManuallyClosed = true;
  clearReconnectTimer();

  if (streamState.socket) {
    streamState.socket.close();
    streamState.socket = null;
  }

  updateStreamStatus('Stream disconnected.', 'offline');
}

app.get('/api/runtime', async (_request, response) => {
  const [lightningCapabilities, localCapabilities, tokenBuilderCapabilities] = await Promise.all([
    fetchUpstream('/api/v1/lightning/capabilities', { method: 'GET' }),
    fetchUpstream('/api/v1/local/capabilities', { method: 'GET' }),
    fetchUpstream('/api/v1/token-builder/capabilities', { method: 'GET' })
  ]);

  return response.json({
    success: true,
    runtime: {
      title: 'Corto.Fun FluxBoard',
      baseUrl: CORTO_BASE_URL,
      wsUrl: CORTO_WS_URL,
      port: WEB_PORT,
      defaultPool: DEFAULT_POOL,
      solPriceUsd: streamState.solPriceUsd,
      cacheLimit: STREAM_CACHE_LIMIT,
      defaultCreateDetail: 'full'
    },
    capabilities: {
      lightning: lightningCapabilities.body,
      local: localCapabilities.body,
      tokenBuilder: tokenBuilderCapabilities.body
    }
  });
});

app.post('/api/stream/connect', (_request, response) => {
  connectUpstreamStream();
  return response.json({ success: true, socketState: 'connecting' });
});

app.post('/api/stream/disconnect', (_request, response) => {
  disconnectUpstreamStream();
  return response.json({ success: true, socketState: 'offline' });
});

app.post('/api/lightning/trade', async (request, response) => {
  const userApiKey = getOptionalUserApiKey(request);

  if (!userApiKey) {
    return response.status(400).json(createConfigError('Paste your Corto.Fun API key in the page before sending Lightning trades.'));
  }

  try {
    const payload = normalizeTradePayload(request.body || {});
    const validationError = validateTradePayload(payload);

    if (validationError) {
      return response.status(400).json({
        success: false,
        error: {
          code: 'TRADING_TERMINAL_V1_VALIDATION_ERROR',
          message: validationError
        }
      });
    }

    const upstream = await fetchUpstream('/api/v1/lightning/trade', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': userApiKey
      },
      body: JSON.stringify({
        ...payload,
        ackMode: 'confirmed',
        maxRouteMs: 1200
      })
    });

    return response.status(upstream.status).json(upstream.body);
  } catch (error) {
    return response.status(500).json({
      success: false,
      error: {
        code: 'TRADING_TERMINAL_V1_LIGHTNING_ERROR',
        message: error.message
      }
    });
  }
});

app.post('/api/local/build-trade', async (request, response) => {
  try {
    const payload = normalizeTradePayload(request.body || {});
    const userApiKey = getOptionalUserApiKey(request);
    const validationError = validateTradePayload(payload, { requirePublicKey: true });

    if (validationError) {
      return response.status(400).json({
        success: false,
        error: {
          code: 'TRADING_TERMINAL_V1_VALIDATION_ERROR',
          message: validationError
        }
      });
    }

    const upstream = await fetchUpstream('/api/v1/local/trade', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(userApiKey ? { 'x-api-key': userApiKey } : {})
      },
      body: JSON.stringify(payload)
    });

    return response.status(upstream.status).json(upstream.body);
  } catch (error) {
    return response.status(500).json({
      success: false,
      error: {
        code: 'TRADING_TERMINAL_V1_LOCAL_ERROR',
        message: error.message
      }
    });
  }
});

app.post('/api/token-builder/create', upload.single('image'), async (request, response) => {
  const userApiKey = getOptionalUserApiKey(request);

  if (!userApiKey) {
    return response.status(400).json(createConfigError('Paste your Corto.Fun API key in the page before creating tokens.'));
  }

  if (!request.file) {
    return response.status(400).json({
      success: false,
      error: {
        code: 'TRADING_TERMINAL_V1_CREATE_VALIDATION_ERROR',
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
        'x-api-key': userApiKey
      },
      body: form
    });

    return response.status(upstream.status).json(upstream.body);
  } catch (error) {
    return response.status(500).json({
      success: false,
      error: {
        code: 'TRADING_TERMINAL_V1_CREATE_ERROR',
        message: error.message
      }
    });
  }
});

app.post('/api/token-builder/claim', async (request, response) => {
  const userApiKey = getOptionalUserApiKey(request);

  if (!userApiKey) {
    return response.status(400).json(createConfigError('Paste your Corto.Fun API key in the page before claiming cashback or creator fee.'));
  }

  try {
    const upstream = await fetchUpstream('/api/v1/token-builder/claim-cashback', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': userApiKey
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
        code: 'TRADING_TERMINAL_V1_CLAIM_ERROR',
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
        code: 'TRADING_TERMINAL_V1_STATUS_ERROR',
        message: error.message
      }
    });
  }
});

connectUpstreamStream();
refreshSolPriceUsd();
setInterval(refreshSolPriceUsd, SOL_PRICE_REFRESH_MS);

const frontendStreamServer = new WebSocketServer({ server, path: '/api/stream' });

frontendStreamServer.on('connection', (socket) => {
  streamState.clients.add(socket);

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'snapshot', payload: buildStreamSnapshot() }));
  }

  socket.on('close', () => {
    streamState.clients.delete(socket);
  });

  socket.on('error', () => {
    streamState.clients.delete(socket);
  });
});

server.listen(WEB_PORT, () => {
  console.log(`Trading Terminal v1 example is running at http://localhost:${WEB_PORT}`);
});