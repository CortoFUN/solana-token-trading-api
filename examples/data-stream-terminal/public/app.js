const MAX_BUFFER_BYTES = 50 * 1024 * 1024;
const DEFAULT_RENDER_LIMIT = 120;
const PRODUCTION_WS_ENDPOINT = 'wss://corto.fun/data-stream';
const encoder = new TextEncoder();

const QUICK_MODE_EVENT_MAP = {
  mints: ['create'],
  trades: ['buy', 'sell'],
  migrations: ['migration'],
  pools: ['createPool', 'addLiquidity', 'removeLiquidity', 'burn'],
};

const PUBLIC_CREATE_DETAIL_OPTIONS = ['min', 'mid', 'full'];
const DEFAULT_CREATE_DETAIL = 'full';
const CREATE_DETAIL_LABELS = {
  min: 'Min',
  mid: 'Mid',
  full: 'Full',
};
const CREATE_DETAIL_HINTS = {
  min: 'Smallest create payload for feed routing and fast inspection.',
  mid: 'Balanced create payload with market and risk basics.',
  full: 'Rich create payload. This is the default contract level.',
};

const state = {
  socket: null,
  socketReady: null,
  reconnectTimer: null,
  reconnectAttempt: 0,
  keepAliveTimer: null,
  lastInboundAt: 0,
  lastDesiredPayloadText: null,
  manualSocketClose: false,
  isPaused: false,
  autoScroll: true,
  builderView: 'beginner',
  activeSnippetLanguage: 'javascript',
  activeSchema: 'handshake',
  entries: [],
  totalBytes: 0,
  nextEntryId: 1,
  activeFilters: new Set(),
  availableFilters: new Set(['handshake', 'subscription_ack', 'current_state', 'error']),
  modeOptions: ['all', 'mints', 'trades', 'migrations', 'pools'],
  poolOptions: ['bags.fm', 'pump.fun', 'pump.swap', 'raydium.amm', 'raydium.cpmm', 'meteora.dlmm', 'letsbonk.fun', 'meteora.damm-v1', 'meteora.damm-v2'],
  eventOptions: ['create', 'trade', 'buy', 'sell', 'migration', 'createPool', 'addLiquidity', 'removeLiquidity', 'burn'],
  selectedQuickModes: new Set(),
  selectedPools: new Set(),
  selectedEvents: new Set(),
  createDetail: DEFAULT_CREATE_DETAIL,
  activeModalEntry: null,
};

const schemaExamples = {
  handshake: {
    type: 'service',
    name: 'handshake',
    state: {
      status: 'connected',
      availablePools: ['pump.swap', 'raydium.amm', 'raydium.cpmm', 'meteora.dlmm', 'letsbonk.fun', 'meteora.damm-v1', 'meteora.damm-v2', 'bags.fm'],
      availableEvents: ['create', 'trade', 'buy', 'sell', 'migration', 'createPool', 'addLiquidity', 'removeLiquidity', 'burn'],
      supportedModes: ['all', 'mints', 'trades', 'migrations', 'pools'],
      supportedMessages: ['subscribe', 'unsubscribe', 'current_state'],
      effectiveFilter: {
        mode: 'none',
        subscriptions: {},
        graceActive: true,
      },
      subscriptionGraceMs: 3000,
    },
  },
  subscription_ack: {
    type: 'service',
    name: 'subscription_ack',
    action: 'subscribe',
    state: {
      availablePools: ['pump.swap', 'raydium.amm', 'raydium.cpmm', 'meteora.dlmm', 'letsbonk.fun', 'meteora.damm-v1', 'meteora.damm-v2', 'bags.fm'],
      availableEvents: ['create', 'trade', 'buy', 'sell', 'migration', 'createPool', 'addLiquidity', 'removeLiquidity', 'burn'],
      supportedModes: ['all', 'mints', 'trades', 'migrations', 'pools'],
      supportedMessages: ['subscribe', 'unsubscribe', 'current_state'],
      effectiveFilter: {
        mode: 'all',
        subscriptions: {},
        graceActive: false,
      },
    },
  },
  current_state: {
    type: 'service',
    name: 'current_state',
    state: {
      availablePools: ['pump.swap', 'raydium.amm', 'raydium.cpmm', 'meteora.dlmm', 'letsbonk.fun', 'meteora.damm-v1', 'meteora.damm-v2', 'bags.fm'],
      availableEvents: ['create', 'trade', 'buy', 'sell', 'migration', 'createPool', 'addLiquidity', 'removeLiquidity', 'burn'],
      supportedModes: ['all', 'mints', 'trades', 'migrations', 'pools'],
      supportedMessages: ['subscribe', 'unsubscribe', 'current_state'],
      effectiveFilter: {
        mode: 'custom',
        subscriptions: {
          create: ['bags.fm', 'letsbonk.fun', 'pump.fun'],
          createPool: ['bags.fm', 'pump.swap'],
        },
        graceActive: false,
      },
    },
  },
  error: {
    type: 'service',
    name: 'error',
    state: {
      availablePools: ['pump.swap', 'raydium.amm', 'raydium.cpmm', 'meteora.dlmm', 'letsbonk.fun', 'meteora.damm-v1', 'meteora.damm-v2', 'bags.fm'],
      availableEvents: ['create', 'trade', 'buy', 'sell', 'migration', 'createPool', 'addLiquidity', 'removeLiquidity', 'burn'],
      supportedModes: ['all', 'mints', 'trades', 'migrations', 'pools'],
      supportedMessages: ['subscribe', 'unsubscribe', 'current_state'],
      effectiveFilter: {
        mode: 'none',
        subscriptions: {},
      },
    },
    error: {
      code: 'invalid_subscription',
      message: 'Do not combine mode with events or pools in the same subscription message.',
    },
  },
};

const elements = {
  endpointInput: document.querySelector('#endpoint-input'),
  createDetailOptions: document.querySelector('#create-detail-options'),
  createDetailHint: document.querySelector('#create-detail-hint'),
  createDetailStatus: document.querySelector('#create-detail-status'),
  connectionStatus: document.querySelector('#connection-status'),
  connectionStatusPill: document.querySelector('#connection-status-pill'),
  audienceTabs: [...document.querySelectorAll('#audience-tabs .segment')],
  quickModeOptions: document.querySelector('#quick-mode-options'),
  beginnerPanel: document.querySelector('#beginner-panel'),
  proPanel: document.querySelector('#pro-panel'),
  poolOptions: document.querySelector('#pool-options'),
  eventOptions: document.querySelector('#event-options'),
  poolHint: document.querySelector('#pool-hint'),
  eventHint: document.querySelector('#event-hint'),
  statusButton: document.querySelector('#status-button'),
  copyPayloadButton: document.querySelector('#copy-payload-button'),
  snippetPreview: document.querySelector('#snippet-preview'),
  payloadPreview: document.querySelector('#payload-preview'),
  schemaPreview: document.querySelector('#schema-preview'),
  snippetTabs: [...document.querySelectorAll('#snippet-tabs .snippet-tab')],
  schemaTabs: [...document.querySelectorAll('#schema-tabs .snippet-tab')],
  previewActionLabel: document.querySelector('#preview-action-label'),
  modeHint: document.querySelector('#mode-hint'),
  runtimeSummary: document.querySelector('#runtime-summary'),
  searchInput: document.querySelector('#search-input'),
  renderLimitSelect: document.querySelector('#render-limit-select'),
  messageFilterRow: document.querySelector('#message-filter-row'),
  streamStats: document.querySelector('#stream-stats'),
  streamOutput: document.querySelector('#stream-output'),
  bufferPill: document.querySelector('#buffer-pill'),
  pauseButton: document.querySelector('#pause-button'),
  playButton: document.querySelector('#play-button'),
  clearStreamButton: document.querySelector('#clear-stream-button'),
  autoScrollToggle: document.querySelector('#autoscroll-toggle'),
  streamEntryTemplate: document.querySelector('#stream-entry-template'),
  poolsAllButton: document.querySelector('#pools-all-button'),
  poolsNoneButton: document.querySelector('#pools-none-button'),
  eventsAllButton: document.querySelector('#events-all-button'),
  eventsNoneButton: document.querySelector('#events-none-button'),
  eventModal: document.querySelector('#event-modal'),
  eventModalSummary: document.querySelector('#event-modal-summary'),
  eventModalJson: document.querySelector('#event-modal-json'),
  eventModalCloseButton: document.querySelector('#event-modal-close-button'),
  eventModalCopyButton: document.querySelector('#event-modal-copy-button'),
};

function deriveDefaultEndpoint() {
  const configuredEndpoint = window.CORTO_DATA_STREAM_TERMINAL_CONFIG?.wsEndpoint;
  return configuredEndpoint || PRODUCTION_WS_ENDPOINT;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function syntaxHighlight(value) {
  return escapeHtml(value).replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let className = 'json-number';

    if (match.startsWith('"')) {
      className = match.endsWith(':') ? 'json-key' : 'json-string';
    } else if (match === 'true' || match === 'false') {
      className = 'json-boolean';
    } else if (match === 'null') {
      className = 'json-null';
    }

    return `<span class="${className}">${match}</span>`;
  });
}

function highlightCode(language, value) {
  return value.split('\n').map((line) => {
    const trimmed = line.trimStart();
    const isComment = (language === 'javascript' && trimmed.startsWith('//'))
      || (language === 'python' && trimmed.startsWith('#'))
      || (language === 'cli' && trimmed.startsWith('#'));

    if (isComment) {
      return `<span class="code-comment">${escapeHtml(line)}</span>`;
    }

    let html = escapeHtml(line);
    html = html.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="code-string">$1</span>');

    if (language === 'javascript') {
      html = html.replace(/\b(import|from|const|new)\b/g, '<span class="code-keyword">$1</span>');
      html = html.replace(/\b(WebSocket|JSON|console)\b/g, '<span class="code-symbol">$1</span>');
    } else if (language === 'python') {
      html = html.replace(/\b(import|async|await|with|as|def)\b/g, '<span class="code-keyword">$1</span>');
      html = html.replace(/\b(asyncio|json|websockets)\b/g, '<span class="code-symbol">$1</span>');
    } else if (language === 'cli') {
      html = html.replace(/\b(curl|printf|websocat)\b/g, '<span class="code-keyword">$1</span>');
    }

    return html;
  }).join('\n');
}

function formatBytes(value) {
  if (value < 1024) {
    return `${value} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let size = value / 1024;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
}

function renderJsonInto(pre, objectValue) {
  pre.innerHTML = syntaxHighlight(JSON.stringify(objectValue, null, 2));
}

function classifyPayload(payload) {
  if (payload && typeof payload.name === 'string' && payload.type === 'service') {
    return payload.name;
  }

  if (payload && typeof payload.txType === 'string') {
    return payload.txType;
  }

  if (payload && typeof payload.type === 'string') {
    return payload.type;
  }

  return 'unknown';
}

function addEntry(payload) {
  const text = JSON.stringify(payload, null, 2);
  const kind = classifyPayload(payload);
  const size = encoder.encode(text).length;
  const entry = {
    id: state.nextEntryId++,
    createdAt: new Date(),
    kind,
    size,
    text,
    html: syntaxHighlight(text),
  };

  state.entries.push(entry);
  state.totalBytes += size;
  state.availableFilters.add(kind);
  trimEntries();
  renderFilterChips();
  updateStatusMeta();

  if (!state.isPaused) {
    renderEntries();
  }

  syncBuilderFromServer(payload);
}

function trimEntries() {
  while (state.totalBytes > MAX_BUFFER_BYTES && state.entries.length > 0) {
    const removed = state.entries.shift();
    state.totalBytes -= removed.size;
  }
}

function getFilteredEntries() {
  const searchTerm = elements.searchInput.value.trim().toLowerCase();
  const renderLimit = Number.parseInt(elements.renderLimitSelect.value, 10) || DEFAULT_RENDER_LIMIT;

  return state.entries
    .filter((entry) => {
      const filterPass = state.activeFilters.size === 0 || state.activeFilters.has(entry.kind);
      const searchPass = searchTerm.length === 0 || entry.text.toLowerCase().includes(searchTerm);
      return filterPass && searchPass;
    })
    .slice(-renderLimit);
}

function updateStreamStats(renderedCount, totalCount) {
  elements.streamStats.textContent = `${renderedCount} rendered / ${totalCount} stored / ${formatBytes(state.totalBytes)} in FIFO buffer.`;
}

async function copyTextWithFeedback(text, button, idleLabel, successLabel = 'Copied') {
  await navigator.clipboard.writeText(text);
  button.textContent = successLabel;
  button.classList.add('is-copied');
  setTimeout(() => {
    button.textContent = idleLabel;
    button.classList.remove('is-copied');
  }, 1200);
}

function openEventModal(entry) {
  state.activeModalEntry = entry;
  elements.eventModalSummary.textContent = `${entry.kind} • ${entry.createdAt.toLocaleTimeString()} • ${formatBytes(entry.size)}`;
  elements.eventModalJson.innerHTML = entry.html;
  elements.eventModal.hidden = false;
  document.body.classList.add('modal-open');
}

function closeEventModal() {
  state.activeModalEntry = null;
  elements.eventModal.hidden = true;
  document.body.classList.remove('modal-open');
}

function renderEntries() {
  const entries = getFilteredEntries();
  elements.streamOutput.innerHTML = '';

  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = state.entries.length === 0
      ? 'Choose a model or pro filter. The socket will connect automatically and real-time JSON will appear here.'
      : 'No entries match the current filters.';
    elements.streamOutput.append(empty);
    updateStreamStats(0, state.entries.length);
    return;
  }

  const fragment = document.createDocumentFragment();

  entries.forEach((entry) => {
    const node = elements.streamEntryTemplate.content.firstElementChild.cloneNode(true);
    const badgeButton = node.querySelector('.stream-badge');
    const copyButton = node.querySelector('.stream-copy-button');

    badgeButton.textContent = entry.kind;
    badgeButton.addEventListener('click', () => openEventModal(entry));

    copyButton.addEventListener('click', () => {
      copyTextWithFeedback(entry.text, copyButton, 'Copy').catch((error) => addEntry({ type: 'local_error', message: error.message }));
    });

    node.querySelector('.stream-time').textContent = entry.createdAt.toLocaleTimeString();
    node.querySelector('.stream-size').textContent = formatBytes(entry.size);
    node.querySelector('.stream-json').innerHTML = entry.html;
    fragment.append(node);
  });

  elements.streamOutput.append(fragment);
  updateStreamStats(entries.length, state.entries.length);

  if (state.autoScroll) {
    elements.streamOutput.scrollTop = elements.streamOutput.scrollHeight;
  }
}

function updateStatusMeta() {
  elements.bufferPill.textContent = `Buffer ${formatBytes(state.totalBytes)}`;
}

function syncEndpointDisplay() {
  updateBuilderViews();
}

function setConnectionState(label, mode) {
  elements.connectionStatus.textContent = label;
  elements.connectionStatusPill.dataset.state = mode;
}

function clearReconnectTimer() {
  if (!state.reconnectTimer) {
    return;
  }

  window.clearTimeout(state.reconnectTimer);
  state.reconnectTimer = null;
}

function stopKeepAlive() {
  if (!state.keepAliveTimer) {
    return;
  }

  window.clearInterval(state.keepAliveTimer);
  state.keepAliveTimer = null;
}

function startKeepAlive(socket) {
  stopKeepAlive();
  state.lastInboundAt = Date.now();

  state.keepAliveTimer = window.setInterval(() => {
    if (!state.socket || state.socket !== socket || socket.readyState !== WebSocket.OPEN) {
      stopKeepAlive();
      return;
    }

    if (Date.now() - state.lastInboundAt > 45_000) {
      addEntry({ type: 'local_error', message: 'socket stale timeout; reconnecting' });
      socket.close();
      return;
    }

    try {
      socket.send(JSON.stringify({ type: 'ping' }));
    } catch {
      socket.close();
    }
  }, 15_000);
}

function scheduleReconnect(reason = 'close') {
  if (state.manualSocketClose || !state.lastDesiredPayloadText || state.reconnectTimer) {
    return;
  }

  const delay = Math.min(1000 * (2 ** state.reconnectAttempt), 30_000);
  state.reconnectAttempt += 1;
  setConnectionState(`Reconnecting (${Math.round(delay / 1000)}s)`, 'connecting');

  state.reconnectTimer = window.setTimeout(() => {
    state.reconnectTimer = null;

    connectSocket()
      .catch(() => {
        scheduleReconnect(reason);
      });
  }, delay);
}

function closeSocket({ manual = true } = {}) {
  state.manualSocketClose = manual;
  clearReconnectTimer();
  stopKeepAlive();

  if (state.socket) {
    state.socket.onopen = null;
    state.socket.onmessage = null;
    state.socket.onerror = null;
    state.socket.onclose = null;
    state.socket.close();
  }

  state.socket = null;
  state.socketReady = null;
  setConnectionState('Disconnected', 'idle');
}

function attachSocketHandlers(socket) {
  socket.addEventListener('message', (event) => {
    state.lastInboundAt = Date.now();

    try {
      const payload = JSON.parse(event.data);
      if (payload?.type === 'pong') {
        return;
      }

      addEntry(payload);
    } catch {
      addEntry({ type: 'local_error', raw: String(event.data) });
    }
  });

  socket.addEventListener('error', () => {
    setConnectionState('Socket error', 'error');
  });

  socket.addEventListener('close', () => {
    state.socket = null;
    state.socketReady = null;
    stopKeepAlive();
    setConnectionState('Disconnected', 'idle');

    if (!state.manualSocketClose) {
      scheduleReconnect('close');
    }
  });
}

function connectSocket() {
  if (state.socket && state.socket.readyState === WebSocket.OPEN) {
    return Promise.resolve(state.socket);
  }

  if (state.socketReady) {
    return state.socketReady;
  }

  const endpoint = elements.endpointInput.value.trim();
  state.manualSocketClose = false;
  setConnectionState('Connecting', 'connecting');

  state.socketReady = new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    state.socket = socket;
    attachSocketHandlers(socket);

    socket.addEventListener('open', () => {
      clearReconnectTimer();
      state.reconnectAttempt = 0;
      setConnectionState('Connected', 'connected');
      startKeepAlive(socket);

      if (state.lastDesiredPayloadText) {
        socket.send(state.lastDesiredPayloadText);
      }

      resolve(socket);
    }, { once: true });

    socket.addEventListener('error', () => {
      setConnectionState('Socket error', 'error');
      reject(new Error('socket connection failed'));
    }, { once: true });
  }).finally(() => {
    state.socketReady = null;
  });

  return state.socketReady;
}

function getQuickModeUnionEvents() {
  const events = new Set();

  for (const mode of state.selectedQuickModes) {
    if (mode === 'all') {
      continue;
    }

    for (const eventName of QUICK_MODE_EVENT_MAP[mode] ?? []) {
      events.add(eventName);
    }
  }

  return [...events];
}

function buildBeginnerSubscribePayload() {
  const selectedModes = [...state.selectedQuickModes];

  if (selectedModes.length === 0) {
    return { type: 'unsubscribe' };
  }

  if (state.selectedQuickModes.has('all')) {
    return {
      type: 'subscribe',
      mode: 'all',
    };
  }

  if (selectedModes.length === 1) {
    return {
      type: 'subscribe',
      mode: selectedModes[0],
    };
  }

  return {
    type: 'subscribe',
    events: getQuickModeUnionEvents(),
  };
}

function payloadCanIncludeCreate(payload) {
  if (payload?.type !== 'subscribe') {
    return false;
  }

  if (payload.mode === 'all' || payload.mode === 'mints') {
    return true;
  }

  if (!Array.isArray(payload.events) || payload.events.length === 0) {
    return true;
  }

  return payload.events.includes('create');
}

function attachCreateOptions(payload) {
  if (!payloadCanIncludeCreate(payload)) {
    delete payload.create;
    return payload;
  }

  payload.create = { detail: state.createDetail };
  return payload;
}

function normalizePublicCreateDetail(detail) {
  if (!PUBLIC_CREATE_DETAIL_OPTIONS.includes(detail)) {
    return DEFAULT_CREATE_DETAIL;
  }

  return detail;
}

function resolveCreateDetailFromService(payload) {
  const effectiveDetail = payload?.state?.effectiveFilter?.createDetail;
  const normalized = normalizePublicCreateDetail(effectiveDetail);
  return effectiveDetail ? normalized : null;
}

function buildProSubscribePayload() {
  if (state.selectedEvents.size === 0 && state.selectedPools.size === 0) {
    return { type: 'unsubscribe' };
  }

  const payload = { type: 'subscribe' };

  if (state.selectedEvents.size > 0) {
    payload.events = [...state.selectedEvents];
  }

  if (state.selectedPools.size > 0) {
    payload.pools = [...state.selectedPools];
  }

  return payload;
}

function buildPayload(kind = 'subscribe') {
  if (kind === 'current_state') {
    return { type: 'current_state' };
  }

  const payload = state.builderView === 'beginner'
    ? buildBeginnerSubscribePayload()
    : buildProSubscribePayload();

  return attachCreateOptions(payload);
}

function buildSnippet(language) {
  const endpoint = elements.endpointInput.value.trim();
  const payload = buildPayload('subscribe');
  const payloadText = JSON.stringify(payload, null, 2);

  if (language === 'python') {
    return [
      '# Data stream example using the exact payload from the preview.',
      '# Send the request once and print every incoming message.',
      'import asyncio',
      'import json',
      'import websockets',
      '',
      `ENDPOINT = ${JSON.stringify(endpoint)}`,
      `PAYLOAD = json.loads('''${payloadText}''')`,
      '',
      'async def main():',
      '    async with websockets.connect(ENDPOINT) as ws:',
      '        await ws.send(json.dumps(PAYLOAD))',
      '        async for message in ws:',
      '            print(json.loads(message))',
      '',
      'asyncio.run(main())',
    ].join('\n');
  }

  if (language === 'cli') {
    return [
      '# Data stream example using the exact payload from the preview.',
      '# Requires websocat: https://github.com/vi/websocat',
      `printf '%s\n' '${JSON.stringify(payload)}' | websocat ${JSON.stringify(endpoint)}`,
    ].join('\n');
  }

  return [
    '// Data stream example using the exact payload from the preview.',
    '// Connect once, send the request, and print every incoming message.',
    "import WebSocket from 'ws';",
    '',
    `const socket = new WebSocket(${JSON.stringify(endpoint)});`,
    '',
    "socket.on('open', () => {",
    `  socket.send(JSON.stringify(${payloadText.split('\n').join('\n  ')}));`,
    '});',
    '',
    "socket.on('message', (data) => {",
    "  console.log(JSON.parse(String(data)));",
    '});',
  ].join('\n');
}

function getPoolTone(value) {
  if (value.startsWith('pump.')) return 'pump';
  if (value.startsWith('letsbonk')) return 'bonk';
  if (value.startsWith('meteora')) return 'meteora';
  if (value.startsWith('bags')) return 'bags';
  if (value.startsWith('raydium')) return 'raydium';
  return 'default';
}

function getEventTone(value) {
  if (value === 'create') return 'create';
  if (value === 'trade' || value === 'buy' || value === 'sell') return 'trade';
  if (value === 'migration') return 'migration';
  return 'pool';
}

function createToggleButton({ label, selected, tone, onClick }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `toggle-chip${selected ? ' is-active' : ''}`;
  button.dataset.tone = tone;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function renderQuickModes() {
  elements.quickModeOptions.innerHTML = '';

  for (const mode of state.modeOptions) {
    elements.quickModeOptions.append(createToggleButton({
      label: mode,
      selected: state.selectedQuickModes.has(mode),
      tone: mode === 'all' ? 'all' : 'quick',
      onClick: () => toggleQuickMode(mode),
    }));
  }
}

function renderProOptions() {
  elements.poolOptions.innerHTML = '';
  elements.eventOptions.innerHTML = '';

  for (const poolName of state.poolOptions) {
    elements.poolOptions.append(createToggleButton({
      label: poolName,
      selected: state.selectedPools.has(poolName),
      tone: getPoolTone(poolName),
      onClick: () => toggleProOption('pool', poolName),
    }));
  }

  for (const eventName of state.eventOptions) {
    elements.eventOptions.append(createToggleButton({
      label: eventName,
      selected: state.selectedEvents.has(eventName),
      tone: getEventTone(eventName),
      onClick: () => toggleProOption('event', eventName),
    }));
  }

  elements.poolHint.textContent = state.selectedPools.size === 0
    ? 'No pool buttons selected: the payload will mean any pool.'
    : `${state.selectedPools.size} pool toggles active.`;

  elements.eventHint.textContent = state.selectedEvents.size === 0
    ? 'No event buttons selected: the payload will mean any event.'
    : `${state.selectedEvents.size} event toggles active.`;
}

function renderRuntimeSummary() {
  const items = [
    ['Endpoint', elements.endpointInput.value.trim()],
    ['Quick modes', state.modeOptions.join(', ')],
    ['Control messages', 'subscribe, unsubscribe, current_state'],
    ['Active builder', state.builderView === 'beginner' ? 'Beginner' : 'Pro'],
    ['Create detail', state.createDetail],
  ];

  elements.runtimeSummary.innerHTML = '';

  items.forEach(([label, value]) => {
    const node = document.createElement('div');
    node.className = 'summary-item';
    node.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    elements.runtimeSummary.append(node);
  });
}

function syncAudienceTabs() {
  elements.audienceTabs.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === state.builderView);
  });

  elements.beginnerPanel.hidden = state.builderView !== 'beginner';
  elements.proPanel.hidden = state.builderView !== 'pro';
}

function renderCreateDetailOptions() {
  if (!elements.createDetailOptions) {
    return;
  }

  elements.createDetailOptions.innerHTML = '';

  for (const detail of PUBLIC_CREATE_DETAIL_OPTIONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `detail-chip${detail === state.createDetail ? ' is-active' : ''}`;
    button.dataset.detail = detail;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(detail === state.createDetail));
    button.innerHTML = `<span class="detail-chip-title">${CREATE_DETAIL_LABELS[detail] ?? detail}</span><span class="detail-chip-copy">${detail}</span>`;
    button.addEventListener('click', () => {
      applyCreateDetail(detail);
    });
    elements.createDetailOptions.append(button);
  }

  if (elements.createDetailStatus) {
    elements.createDetailStatus.textContent = state.createDetail.toUpperCase();
  }

  if (elements.createDetailHint) {
    elements.createDetailHint.textContent = CREATE_DETAIL_HINTS[state.createDetail] ?? '';
  }
}

function applyCreateDetail(detail, { sendRequest = true } = {}) {
  const normalizedDetail = normalizePublicCreateDetail(detail);
  const hasChanged = normalizedDetail !== state.createDetail;
  state.createDetail = normalizedDetail;
  renderCreateDetailOptions();
  updateBuilderViews();

  if (!sendRequest || !hasChanged) {
    return;
  }

  sendCurrentRequest().catch((error) => addEntry({ type: 'local_error', message: error.message }));
}

function updateBuilderViews() {
  const currentPayload = buildPayload('subscribe');
  renderJsonInto(elements.payloadPreview, currentPayload);
  elements.previewActionLabel.textContent = String(currentPayload.type ?? 'subscribe').toUpperCase();
  elements.snippetPreview.innerHTML = highlightCode(state.activeSnippetLanguage, buildSnippet(state.activeSnippetLanguage));
  renderJsonInto(elements.schemaPreview, schemaExamples[state.activeSchema]);

  elements.modeHint.textContent = state.builderView === 'beginner'
    ? 'Click stream models. The socket connects automatically, selected models stay highlighted, and the payload remains short and readable.'
    : 'In pro mode, pool and event toggles send a fresh request immediately. Dim buttons are off, bright buttons are on.';

  renderCreateDetailOptions();

  renderRuntimeSummary();
}

function syncBuilderFromServer(payload) {
  if (payload?.type !== 'service' || !payload?.state) {
    return;
  }

  const nextCreateDetail = resolveCreateDetailFromService(payload);
  if (nextCreateDetail) {
    state.createDetail = nextCreateDetail;
  }

  const nextModes = Array.isArray(payload.state.supportedModes) ? payload.state.supportedModes : null;
  const nextPools = Array.isArray(payload.state.availablePools) ? payload.state.availablePools : null;
  const nextEvents = Array.isArray(payload.state.availableEvents) ? payload.state.availableEvents : null;

  if (nextModes) {
    state.modeOptions = [...nextModes];
    for (const mode of [...state.selectedQuickModes]) {
      if (!nextModes.includes(mode)) {
        state.selectedQuickModes.delete(mode);
      }
    }
  }

  if (nextPools) {
    state.poolOptions = [...nextPools];
    state.selectedPools = new Set([...state.selectedPools].filter((poolName) => nextPools.includes(poolName)));
  }

  if (nextEvents) {
    state.eventOptions = [...nextEvents];
    state.selectedEvents = new Set([...state.selectedEvents].filter((eventName) => nextEvents.includes(eventName)));
  }

  renderQuickModes();
  renderProOptions();
  updateBuilderViews();
}

function toggleQuickMode(mode) {
  if (mode === 'all') {
    if (state.selectedQuickModes.has('all')) {
      state.selectedQuickModes = new Set();
    } else {
      state.selectedQuickModes = new Set(['all']);
    }
  } else {
    if (state.selectedQuickModes.has('all')) {
      state.selectedQuickModes.delete('all');
    }

    if (state.selectedQuickModes.has(mode)) {
      state.selectedQuickModes.delete(mode);
    } else {
      state.selectedQuickModes.add(mode);
    }
  }

  renderQuickModes();
  updateBuilderViews();
  sendCurrentRequest().catch((error) => addEntry({ type: 'local_error', message: error.message }));
}

function toggleProOption(group, value) {
  const targetSet = group === 'pool' ? state.selectedPools : state.selectedEvents;

  if (targetSet.has(value)) {
    targetSet.delete(value);
  } else {
    targetSet.add(value);
  }

  renderProOptions();
  updateBuilderViews();
  sendCurrentRequest().catch((error) => addEntry({ type: 'local_error', message: error.message }));
}

async function sendMessage(payload) {
  const rememberPayload = payload?.type === 'subscribe' || payload?.type === 'unsubscribe';
  if (rememberPayload) {
    state.lastDesiredPayloadText = JSON.stringify(payload);
  }

  const socket = await connectSocket();
  const messageText = rememberPayload ? state.lastDesiredPayloadText : JSON.stringify(payload);
  socket.send(messageText);
}

async function sendCurrentRequest() {
  await sendMessage(buildPayload('subscribe'));
}

function renderFilterChips() {
  const sortedFilters = [...state.availableFilters].sort();
  elements.messageFilterRow.innerHTML = '';

  sortedFilters.forEach((filterName) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `filter-chip${state.activeFilters.has(filterName) ? ' is-active' : ''}`;
    button.textContent = filterName;
    button.addEventListener('click', () => {
      if (state.activeFilters.has(filterName)) {
        state.activeFilters.delete(filterName);
      } else {
        state.activeFilters.add(filterName);
      }

      renderFilterChips();
      if (!state.isPaused) {
        renderEntries();
      }
    });
    elements.messageFilterRow.append(button);
  });
}

async function copyPayload() {
  await copyTextWithFeedback(JSON.stringify(buildPayload('subscribe'), null, 2), elements.copyPayloadButton, 'Copy Payload');
}

function clearEntries() {
  state.entries = [];
  state.totalBytes = 0;
  updateStatusMeta();
  renderEntries();
}

function bindEvents() {
  elements.endpointInput.addEventListener('input', syncEndpointDisplay);

  elements.audienceTabs.forEach((button) => {
    button.addEventListener('click', () => {
      state.builderView = button.dataset.view;
      syncAudienceTabs();
      updateBuilderViews();
    });
  });

  elements.poolsAllButton.addEventListener('click', () => {
    state.selectedPools = new Set(state.poolOptions);
    renderProOptions();
    updateBuilderViews();
    sendCurrentRequest().catch((error) => addEntry({ type: 'local_error', message: error.message }));
  });

  elements.poolsNoneButton.addEventListener('click', () => {
    state.selectedPools = new Set();
    renderProOptions();
    updateBuilderViews();
    sendCurrentRequest().catch((error) => addEntry({ type: 'local_error', message: error.message }));
  });

  elements.eventsAllButton.addEventListener('click', () => {
    state.selectedEvents = new Set(state.eventOptions);
    renderProOptions();
    updateBuilderViews();
    sendCurrentRequest().catch((error) => addEntry({ type: 'local_error', message: error.message }));
  });

  elements.eventsNoneButton.addEventListener('click', () => {
    state.selectedEvents = new Set();
    renderProOptions();
    updateBuilderViews();
    sendCurrentRequest().catch((error) => addEntry({ type: 'local_error', message: error.message }));
  });

  elements.statusButton.addEventListener('click', () => {
    sendMessage({ type: 'current_state' }).catch((error) => addEntry({ type: 'local_error', message: error.message }));
  });

  elements.copyPayloadButton.addEventListener('click', () => {
    copyPayload().catch((error) => addEntry({ type: 'local_error', message: error.message }));
  });

  elements.eventModalCloseButton.addEventListener('click', closeEventModal);
  elements.eventModalCopyButton.addEventListener('click', () => {
    if (!state.activeModalEntry) {
      return;
    }

    copyTextWithFeedback(state.activeModalEntry.text, elements.eventModalCopyButton, 'Copy JSON').catch((error) => addEntry({ type: 'local_error', message: error.message }));
  });

  elements.eventModal.addEventListener('click', (event) => {
    if (event.target === elements.eventModal) {
      closeEventModal();
    }
  });

  elements.snippetTabs.forEach((button) => {
    button.addEventListener('click', () => {
      state.activeSnippetLanguage = button.dataset.language;
      elements.snippetTabs.forEach((item) => item.classList.toggle('is-active', item === button));
      updateBuilderViews();
    });
  });

  elements.schemaTabs.forEach((button) => {
    button.addEventListener('click', () => {
      state.activeSchema = button.dataset.schema;
      elements.schemaTabs.forEach((item) => item.classList.toggle('is-active', item === button));
      updateBuilderViews();
    });
  });

  elements.searchInput.addEventListener('input', () => {
    if (!state.isPaused) {
      renderEntries();
    }
  });

  elements.renderLimitSelect.addEventListener('change', () => {
    if (!state.isPaused) {
      renderEntries();
    }
  });

  elements.pauseButton.addEventListener('click', () => {
    state.isPaused = true;
  });

  elements.playButton.addEventListener('click', () => {
    state.isPaused = false;
    renderEntries();
  });

  elements.clearStreamButton.addEventListener('click', clearEntries);

  elements.autoScrollToggle.addEventListener('change', () => {
    state.autoScroll = elements.autoScrollToggle.checked;
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.eventModal.hidden) {
      closeEventModal();
    }
  });

  window.addEventListener('online', () => {
    if (!state.socket && state.lastDesiredPayloadText) {
      scheduleReconnect('online');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !state.socket && state.lastDesiredPayloadText) {
      scheduleReconnect('visibility');
    }
  });

  window.addEventListener('beforeunload', () => closeSocket({ manual: true }));
}

function init() {
  elements.endpointInput.value = deriveDefaultEndpoint();
  syncEndpointDisplay();
  renderCreateDetailOptions();
  renderQuickModes();
  renderProOptions();
  syncAudienceTabs();
  bindEvents();
  renderFilterChips();
  updateBuilderViews();
  renderEntries();
  updateStatusMeta();
  setConnectionState('Disconnected', 'idle');
}

init();
