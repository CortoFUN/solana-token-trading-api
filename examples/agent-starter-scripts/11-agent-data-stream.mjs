// /examples/agent-starter-scripts/11-agent-data-stream.mjs

function parseStreamList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBooleanFlag(value, defaultValue = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function buildStreamConfig(env = process.env) {
  const mode = String(env.CORTO_STREAM_MODE || '').trim();
  const events = parseStreamList(env.CORTO_STREAM_EVENTS);
  const pools = parseStreamList(env.CORTO_STREAM_POOLS);

  if (mode && (events.length || pools.length)) {
    throw new Error('Do not combine CORTO_STREAM_MODE with CORTO_STREAM_EVENTS or CORTO_STREAM_POOLS');
  }

  return {
    wsUrl: String(env.CORTO_STREAM_WS_URL || 'wss://corto.fun/data-stream').trim(),
    mode,
    events,
    pools,
    createDetail: String(env.CORTO_STREAM_CREATE_DETAIL || '').trim(),
    requestCurrentState: parseBooleanFlag(env.CORTO_STREAM_REQUEST_CURRENT_STATE, true),
    printRaw: parseBooleanFlag(env.CORTO_STREAM_PRINT_RAW, false),
    maxEvents: Math.max(1, Number(env.CORTO_STREAM_MAX_EVENTS || 25)),
    maxRuntimeMs: Math.max(1000, Number(env.CORTO_STREAM_MAX_RUNTIME_MS || 60000))
  };
}

function buildSubscribePayload(config) {
  const payload = { type: 'subscribe' };

  if (config?.mode) payload.mode = config.mode;
  if (Array.isArray(config?.events) && config.events.length) payload.events = config.events;
  if (Array.isArray(config?.pools) && config.pools.length) payload.pools = config.pools;
  if (config?.createDetail) payload.create = { detail: config.createDetail };

  return payload;
}

function summarizeService(message) {
  const state = message?.state || {};
  return {
    kind: 'service',
    name: message?.name || 'unknown',
    action: message?.action || null,
    supportedModes: state.supportedModes || [],
    supportedMessages: state.supportedMessages || [],
    effectiveFilter: state.effectiveFilter || null,
    subscriptionGraceMs: state.subscriptionGraceMs || null
  };
}

function summarizeEvent(message) {
  return {
    kind: 'event',
    event: message?.event || message?.txType || message?.family || message?.schemaVersion || message?.type || 'unknown',
    pool: message?.pool || message?.poolLabel || null,
    mint: message?.mint || message?.baseMint || null,
    signature: message?.signature || message?.txSignature || null,
    slot: message?.slot || null
  };
}

const streamConfig = buildStreamConfig(process.env);

if (typeof WebSocket !== 'function') {
  throw new Error('This script requires the WebSocket global. Use Node 22+ or another runtime with built-in WebSocket support.');
}
const socket = new WebSocket(streamConfig.wsUrl);
const subscribePayload = buildSubscribePayload(streamConfig);
let seenEvents = 0;
let closeScheduled = false;

function closeSocket(reason) {
  if (closeScheduled) return;
  closeScheduled = true;
  console.log(JSON.stringify({ status: 'closing', reason, seenEvents }, null, 2));
  socket.close(1000, reason);
}

const runtimeTimer = setTimeout(() => closeSocket('max-runtime-reached'), streamConfig.maxRuntimeMs);

socket.addEventListener('open', () => {
  console.log(JSON.stringify({ status: 'connected', wsUrl: streamConfig.wsUrl, subscribePayload, maxEvents: streamConfig.maxEvents, maxRuntimeMs: streamConfig.maxRuntimeMs }, null, 2));
  socket.send(JSON.stringify(subscribePayload));
});

socket.addEventListener('message', (message) => {
  const raw = typeof message.data === 'string' ? message.data : String(message.data || '');
  const payload = raw ? JSON.parse(raw) : {};

  if (streamConfig.printRaw) {
    console.log(JSON.stringify({ raw: payload }, null, 2));
  }

  if (payload?.type === 'service') {
    console.log(JSON.stringify(summarizeService(payload), null, 2));
    if (payload?.name === 'handshake' && streamConfig.requestCurrentState) {
      socket.send(JSON.stringify({ type: 'current_state' }));
    }
    return;
  }

  seenEvents += 1;
  console.log(JSON.stringify(summarizeEvent(payload), null, 2));
  if (seenEvents >= streamConfig.maxEvents) {
    closeSocket('max-events-reached');
  }
});

socket.addEventListener('error', (error) => {
  console.error(JSON.stringify({ status: 'error', message: error?.message || 'WebSocket error' }, null, 2));
});

socket.addEventListener('close', (event) => {
  clearTimeout(runtimeTimer);
  console.log(JSON.stringify({ status: 'closed', code: event.code, reason: event.reason || null, seenEvents }, null, 2));
});