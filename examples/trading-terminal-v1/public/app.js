const PRESET_STORAGE_KEY = 'corto-fluxboard-hyperpreset-rack-v20260402';
const LIGHTNING_API_KEY_STORAGE = 'corto-fluxboard-lightning-api-key-v20260402';
const DESK_MODE_STORAGE_KEY = 'corto-fluxboard-desk-mode-v20260402';
const LOCAL_WALLET_STATE_STORAGE_KEY = 'corto-fluxboard-local-wallet-state-v20260402';
const COLUMN_FILTERS_STORAGE_KEY = 'corto-fluxboard-column-filters-v20260402';
const DEFAULT_PRESET_RACK = Object.freeze([
  Object.freeze({ id: 'ion-scout', label: 'Ion Scout', amount: '0.03' }),
  Object.freeze({ id: 'nebula-tap', label: 'Nebula Tap', amount: '0.05' }),
  Object.freeze({ id: 'rift-probe', label: 'Rift Probe', amount: '0.10' }),
  Object.freeze({ id: 'ember-push', label: 'Ember Push', amount: '0.25' }),
  Object.freeze({ id: 'vector-sweep', label: 'Vector Sweep', amount: '0.50' }),
  Object.freeze({ id: 'glacier-exit', label: 'Glacier Exit', amount: '1.00' })
]);
const DEFAULT_LAUNCHPADS = ['raydium-launchlab', 'pump.fun', 'meteora-dbc', 'letsbonk.fun'];
const COLUMN_VISIBLE_LIMIT = 8;

function cloneDefaultPresetRack() {
  return DEFAULT_PRESET_RACK.map((preset) => ({ ...preset }));
}

const state = {
  runtime: null,
  selectedMint: '',
  quickPresets: cloneDefaultPresetRack(),
  presetEditorOpen: false,
  activeDeskMode: 'lightning',
  columnLaunchpads: {
    creates: new Set(DEFAULT_LAUNCHPADS),
    nearFill: new Set(DEFAULT_LAUNCHPADS),
    migrations: new Set(DEFAULT_LAUNCHPADS)
  },
  socket: null,
  socketReconnectTimer: null,
  itemIndex: new Map(),
  columns: {
    creates: new Map(),
    nearFill: new Map(),
    migrations: new Map()
  },
  initializedColumns: new Set(),
  walletConnected: false
};

const elements = {
  createsPill: document.getElementById('createsPill'),
  nearFillPill: document.getElementById('nearFillPill'),
  migrationsPill: document.getElementById('migrationsPill'),
  deskModeLightningButton: document.getElementById('deskModeLightningButton'),
  deskModeLocalButton: document.getElementById('deskModeLocalButton'),
  lightningAuthBar: document.getElementById('lightningAuthBar'),
  lightningApiKey: document.getElementById('lightningApiKey'),
  localWalletBar: document.getElementById('localWalletBar'),
  headerConnectWalletButton: document.getElementById('headerConnectWalletButton'),
  walletBadge: document.getElementById('walletBadge'),
  localPublicKey: document.getElementById('localPublicKey'),
  createsFilterRow: document.getElementById('createsFilterRow'),
  nearFillFilterRow: document.getElementById('nearFillFilterRow'),
  migrationsFilterRow: document.getElementById('migrationsFilterRow'),
  createsList: document.getElementById('createsList'),
  nearFillList: document.getElementById('nearFillList'),
  migrationsList: document.getElementById('migrationsList'),
  statusText: document.getElementById('statusText'),
  toastStack: document.getElementById('toastStack'),
  tradeModal: document.getElementById('tradeModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalSubtitle: document.getElementById('modalSubtitle'),
  modalImage: document.getElementById('modalImage'),
  modalMeta: document.getElementById('modalMeta'),
  closeModalButton: document.getElementById('closeModalButton'),
  quickButtons: document.getElementById('quickButtons'),
  togglePresetRackButton: document.getElementById('togglePresetRackButton'),
  presetRackEditor: document.getElementById('presetRackEditor'),
  tradeAction: document.getElementById('tradeAction'),
  tradeAmount: document.getElementById('tradeAmount'),
  tradeDenominatedInSol: document.getElementById('tradeDenominatedInSol'),
  tradeSlippage: document.getElementById('tradeSlippage'),
  tradePriorityFee: document.getElementById('tradePriorityFee'),
  tradeJitoTip: document.getElementById('tradeJitoTip'),
  tradeMemo: document.getElementById('tradeMemo'),
  tradeModeHint: document.getElementById('tradeModeHint'),
  submitTradeButton: document.getElementById('submitTradeButton')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseNumber(value) {
  if (value === '' || value === undefined || value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value, digits = 2) {
  const parsed = parseNumber(value);
  return parsed === null ? 'n/a' : parsed.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatPercent(value) {
  const parsed = parseNumber(value);
  return parsed === null ? 'n/a' : `${parsed.toFixed(parsed >= 10 ? 0 : 2)}%`;
}

function formatUsd(value) {
  const parsed = parseNumber(value);
  if (parsed === null) {
    return 'n/a';
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: parsed >= 1000 ? 0 : 2
  }).format(parsed);
}

function formatCompactUnit(value, suffix, lowDigits, highDigits) {
  return `${value.toFixed(value >= 100 ? highDigits : lowDigits)}${suffix}`;
}

function formatMarketCapUsd(value) {
  const parsed = parseNumber(value);
  if (parsed === null) {
    return 'n/a';
  }

  if (parsed < 1000) {
    return formatUsd(parsed);
  }

  const units = [
    { threshold: 1_000_000_000_000, suffix: 'T' },
    { threshold: 1_000_000_000, suffix: 'B' },
    { threshold: 1_000_000, suffix: 'M' },
    { threshold: 1_000, suffix: 'k' }
  ];

  const selectedUnit = units.find((entry) => parsed >= entry.threshold) || units[units.length - 1];
  return `$${formatCompactUnit(parsed / selectedUnit.threshold, selectedUnit.suffix, 2, 1)}`;
}

function normalizeRiskLabel(item) {
  const rawLabel = String(item?.riskLevel || '').trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');

  if (['low'].includes(rawLabel)) {
    return 'Low';
  }

  if (['medium', 'mid', 'moderate'].includes(rawLabel)) {
    return 'Mid';
  }

  if (['high', 'very_high', 'veryhigh', 'critical'].includes(rawLabel)) {
    return 'High';
  }

  const score = parseNumber(item?.appRiskScorePercent);
  if (score === null) {
    return 'n/a';
  }

  if (score >= 70) {
    return 'High';
  }

  if (score >= 35) {
    return 'Mid';
  }

  return 'Low';
}

function shortenAddress(value) {
  const normalized = String(value || '').trim();
  if (normalized.length <= 12) {
    return normalized || 'Wallet not connected';
  }

  return `${normalized.slice(0, 4)}....${normalized.slice(-4)}`;
}

function sanitizePresetAmount(value, fallback) {
  const normalized = String(value ?? '').trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed.toFixed(parsed >= 1 ? 2 : 3).replace(/0+$/, '').replace(/\.$/, '');
}

function sanitizePresetLabel(value, fallback) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
  return normalized.slice(0, 24) || fallback;
}

function setSocketState(nextState) {
  document.body.dataset.socketState = nextState;
}

function setStatus(message, tone = 'progress') {
  elements.statusText.textContent = message;
  elements.statusText.className = `desk-status ${tone === 'ok' ? 'tone-ok' : tone === 'bad' ? 'tone-bad' : 'tone-progress'}`;
}

function showToast(title, message, tone = 'success') {
  const toast = document.createElement('article');
  toast.className = `toast toast-${tone}`;
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  elements.toastStack.prepend(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 4200);
}

function persistLightningApiKey() {
  localStorage.setItem(LIGHTNING_API_KEY_STORAGE, elements.lightningApiKey.value.trim());
}

function loadLightningApiKey() {
  elements.lightningApiKey.value = localStorage.getItem(LIGHTNING_API_KEY_STORAGE) || '';
}

function persistDeskMode() {
  localStorage.setItem(DESK_MODE_STORAGE_KEY, state.activeDeskMode);
}

function loadDeskMode() {
  const savedMode = localStorage.getItem(DESK_MODE_STORAGE_KEY);
  state.activeDeskMode = savedMode === 'local' ? 'local' : 'lightning';
}

function persistWalletPreference(isConnected) {
  localStorage.setItem(LOCAL_WALLET_STATE_STORAGE_KEY, isConnected ? 'connected' : 'disconnected');
}

function shouldRestoreWallet() {
  return localStorage.getItem(LOCAL_WALLET_STATE_STORAGE_KEY) === 'connected';
}

function persistColumnFilters() {
  const payload = Object.fromEntries(Object.entries(state.columnLaunchpads).map(([columnKey, launchpads]) => [columnKey, [...launchpads]]));
  localStorage.setItem(COLUMN_FILTERS_STORAGE_KEY, JSON.stringify(payload));
}

function loadColumnFilters() {
  const raw = localStorage.getItem(COLUMN_FILTERS_STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    ['creates', 'nearFill', 'migrations'].forEach((columnKey) => {
      const values = Array.isArray(parsed?.[columnKey]) ? parsed[columnKey].filter((value) => DEFAULT_LAUNCHPADS.includes(value)) : null;
      if (values && values.length > 0) {
        state.columnLaunchpads[columnKey] = new Set(values);
      }
    });
  } catch {
    return;
  }
}

function renderWalletState() {
  const isConnected = state.walletConnected && Boolean(elements.localPublicKey.value.trim());
  elements.walletBadge.textContent = isConnected ? shortenAddress(elements.localPublicKey.value.trim()) : 'Wallet disconnected';
  elements.walletBadge.classList.toggle('is-connected', isConnected);
  elements.headerConnectWalletButton.textContent = isConnected ? 'Disconnect' : 'Connect Phantom';
  elements.headerConnectWalletButton.classList.toggle('button-connect', !isConnected);
  elements.headerConnectWalletButton.classList.toggle('button-disconnect', isConnected);
  elements.headerConnectWalletButton.classList.toggle('button-secondary', false);
}

function renderDeskMode() {
  const isLocal = state.activeDeskMode === 'local';
  elements.deskModeLightningButton.classList.toggle('is-active', !isLocal);
  elements.deskModeLocalButton.classList.toggle('is-active', isLocal);
  elements.lightningAuthBar.hidden = isLocal;
  elements.localWalletBar.hidden = !isLocal;
  persistDeskMode();
  updateTradeModeHint();
}

function setDeskMode(mode) {
  state.activeDeskMode = mode === 'local' ? 'local' : 'lightning';
  renderDeskMode();
}

function loadQuickPresets() {
  const raw = localStorage.getItem(PRESET_STORAGE_KEY);
  if (!raw) {
    state.quickPresets = cloneDefaultPresetRack();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.quickPresets = cloneDefaultPresetRack().map((fallbackPreset, index) => ({
        ...fallbackPreset,
        label: sanitizePresetLabel(parsed[index]?.label, fallbackPreset.label),
        amount: sanitizePresetAmount(parsed[index]?.amount, fallbackPreset.amount)
      }));
      return;
    }
  } catch {
    state.quickPresets = cloneDefaultPresetRack();
    return;
  }

  state.quickPresets = cloneDefaultPresetRack();
}

function saveQuickPresets() {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(state.quickPresets));
  renderQuickButtons();
  renderPresetRackEditor();
}

function renderQuickButtons() {
  elements.quickButtons.innerHTML = state.quickPresets.map((preset, index) => `
    <button type="button" class="button-secondary" data-preset-slot="${index}">
      <span class="preset-chip-label">${escapeHtml(preset.label)}</span>
      <span class="preset-chip-value">${escapeHtml(preset.amount)} SOL</span>
    </button>
  `).join('');
}

function renderPresetRackEditor() {
  elements.presetRackEditor.hidden = !state.presetEditorOpen;
  elements.togglePresetRackButton.textContent = state.presetEditorOpen ? 'Hide rack' : 'Edit rack';
  elements.presetRackEditor.innerHTML = state.quickPresets.map((preset, index) => `
    <article class="preset-editor-card">
      <label>Preset name
        <input type="text" maxlength="24" value="${escapeHtml(preset.label)}" data-preset-label="${index}" placeholder="Preset label" />
      </label>
      <label>Amount SOL
        <input type="number" min="0.001" max="100" step="0.001" value="${escapeHtml(preset.amount)}" data-preset-amount-input="${index}" placeholder="0.05" />
      </label>
    </article>
  `).join('');
}

function togglePresetRackEditor() {
  state.presetEditorOpen = !state.presetEditorOpen;
  renderPresetRackEditor();
}

function updatePresetFromEditor(target) {
  const labelIndex = target.dataset.presetLabel;
  if (labelIndex !== undefined) {
    const fallback = DEFAULT_PRESET_RACK[Number(labelIndex)];
    state.quickPresets[Number(labelIndex)].label = sanitizePresetLabel(target.value, fallback.label);
    saveQuickPresets();
    return;
  }

  const amountIndex = target.dataset.presetAmountInput;
  if (amountIndex !== undefined) {
    const fallback = DEFAULT_PRESET_RACK[Number(amountIndex)];
    state.quickPresets[Number(amountIndex)].amount = sanitizePresetAmount(target.value, fallback.amount);
    saveQuickPresets();
  }
}

function renderColumnFilters(columnKey) {
  const container = elements[`${columnKey}FilterRow`];
  const selectedLaunchpads = state.columnLaunchpads[columnKey];

  container?.querySelectorAll('[data-launchpad]').forEach((button) => {
    button.classList.toggle('is-active', selectedLaunchpads.has(button.dataset.launchpad));
  });
}

function toggleLaunchpadFilter(columnKey, launchpad) {
  const selectedLaunchpads = state.columnLaunchpads[columnKey];
  if (!selectedLaunchpads) {
    return;
  }

  if (selectedLaunchpads.has(launchpad)) {
    selectedLaunchpads.delete(launchpad);
  } else {
    selectedLaunchpads.add(launchpad);
  }

  persistColumnFilters();
  renderColumnFilters(columnKey);
  renderCurrentSnapshot();
}

function getRiskTone(item) {
  const riskLabel = normalizeRiskLabel(item);
  if (riskLabel === 'High') {
    return 'pill is-danger';
  }
  if (riskLabel === 'Mid') {
    return 'pill is-warn';
  }
  if (riskLabel === 'Low') {
    return 'pill is-good';
  }

  return 'pill';
}

function getCurveTone(progress) {
  const parsed = parseNumber(progress);
  if (parsed === null) {
    return 'pill';
  }
  if (parsed >= 95) {
    return 'pill is-warn';
  }
  if (parsed >= 70) {
    return 'pill is-good';
  }
  return 'pill';
}

function getCurveFillPercent(progress) {
  const parsed = parseNumber(progress);
  if (parsed === null) {
    return 0;
  }

  return Math.max(0, Math.min(100, parsed));
}

function createCardNode(item) {
  const node = document.createElement('article');
  node.className = 'stream-card';
  node.dataset.mint = item.mint;
  node.innerHTML = `
    <img class="stream-image" alt="Token preview" hidden />
    <div class="stream-copy">
      <div class="stream-title-row">
        <strong class="stream-name"></strong>
        <span class="stream-symbol"></span>
      </div>
      <div class="stream-foot-row">
        <span class="stream-launchpad"></span>
      </div>
      <div class="stream-metric-row">
        <span class="metric-chip metric-volume"></span>
        <span class="metric-chip metric-buy"></span>
        <span class="metric-chip metric-sell"></span>
      </div>
      <div class="stream-inline-stats">
        <span class="inline-stat card-marketcap"></span>
        <span class="inline-stat card-curve"></span>
      </div>
    </div>
    <div class="stream-side">
      <span class="inline-stat card-risk"></span>
      <button type="button" class="button-primary card-action">Trade</button>
    </div>
  `;

  return node;
}

function updateCardNode(node, item) {
  const title = node.querySelector('.stream-name');
  const symbol = node.querySelector('.stream-symbol');
  const image = node.querySelector('.stream-image');
  const launchpad = node.querySelector('.stream-launchpad');
  const volume = node.querySelector('.metric-volume');
  const buy = node.querySelector('.metric-buy');
  const sell = node.querySelector('.metric-sell');
  const risk = node.querySelector('.card-risk');
  const curve = node.querySelector('.card-curve');
  const marketCap = node.querySelector('.card-marketcap');
  const action = node.querySelector('.card-action');
  const buyCount = parseNumber(item.buyCount ?? 0) ?? 0;
  const sellCount = parseNumber(item.sellCount ?? 0) ?? 0;

  title.textContent = item.displayName || item.name || item.symbol || 'Token';
  symbol.textContent = item.displaySymbol || item.symbol || '';
  launchpad.textContent = item.displayLaunchpad || item.launchpad || item.pool || '';
  volume.textContent = `Vol ${formatNumber(item.volumeSol ?? item.volume ?? 0, 1)} SOL`;
  buy.textContent = `Buy ${formatNumber(buyCount, 0)}`;
  sell.textContent = `Sell ${formatNumber(sellCount, 0)}`;

  if (item.imageUrl) {
    if (image.getAttribute('src') !== item.imageUrl) {
      image.setAttribute('src', item.imageUrl);
    }
    image.hidden = false;
  } else {
    image.hidden = true;
    image.removeAttribute('src');
  }

  risk.className = `${getRiskTone(item)} inline-stat card-risk`;
  risk.textContent = `Risk ${normalizeRiskLabel(item)}`;

  curve.className = `${getCurveTone(item.bondingCurveProgress)} inline-stat card-curve`;
  curve.style.setProperty('--curve-fill', `${getCurveFillPercent(item.bondingCurveProgress)}%`);
  curve.textContent = `Curve ${formatPercent(item.bondingCurveProgress)}`;

  marketCap.className = 'inline-stat card-marketcap';
  marketCap.textContent = `MC ${formatMarketCapUsd(item.marketCapUsd)}`;

  action.dataset.openMint = item.mint;
}

function filterColumnItems(columnKey, items) {
  const selectedLaunchpads = state.columnLaunchpads[columnKey];
  return limitColumnItems(items.filter((item) => selectedLaunchpads.has(item.launchpad)));
}

function limitColumnItems(items) {
  if (!Array.isArray(items) || items.length <= COLUMN_VISIBLE_LIMIT) {
    return items;
  }

  return items.slice(-COLUMN_VISIBLE_LIMIT);
}

function renderEmptyState(container, title, copy) {
  container.innerHTML = `
    <div class="empty-state" data-empty="true">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p class="empty-copy">${escapeHtml(copy)}</p>
      </div>
    </div>
  `;
}

function patchColumn(columnKey, container, items, emptyTitle, emptyCopy) {
  const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 24;
  const isFirstPaint = !state.initializedColumns.has(columnKey);
  const nodeMap = state.columns[columnKey];
  const visibleMints = new Set(items.map((item) => item.mint));

  if (!items.length) {
    nodeMap.clear();
    renderEmptyState(container, emptyTitle, emptyCopy);
    state.initializedColumns.add(columnKey);
    return;
  }

  const emptyNode = container.querySelector('[data-empty="true"]');
  if (emptyNode) {
    emptyNode.remove();
  }

  items.forEach((item) => {
    let node = nodeMap.get(item.mint);
    if (!node) {
      node = createCardNode(item);
      nodeMap.set(item.mint, node);
    }

    updateCardNode(node, item);
  });

  items.forEach((item, index) => {
    const node = nodeMap.get(item.mint);
    const referenceNode = container.children[index] || null;

    if (referenceNode !== node) {
      container.insertBefore(node, referenceNode);
    }
  });

  [...nodeMap.keys()].forEach((mint) => {
    if (!visibleMints.has(mint)) {
      const node = nodeMap.get(mint);
      node?.remove();
      nodeMap.delete(mint);
    }
  });

  if (isFirstPaint || nearBottom) {
    container.scrollTop = container.scrollHeight;
  }

  state.initializedColumns.add(columnKey);
}

function renderCurrentSnapshot() {
  if (!state.latestSnapshot) {
    return;
  }

  const snapshot = state.latestSnapshot;
  const creates = filterColumnItems('creates', snapshot.columns.creates);
  const nearFill = filterColumnItems('nearFill', snapshot.columns.nearFill);
  const migrations = filterColumnItems('migrations', snapshot.columns.migrations);

  state.itemIndex = new Map();
  [...creates, ...nearFill, ...migrations].forEach((item) => {
    state.itemIndex.set(item.mint, item);
  });

  elements.createsPill.textContent = `${creates.length}/${COLUMN_VISIBLE_LIMIT} visible`;
  elements.nearFillPill.textContent = `${nearFill.length}/${COLUMN_VISIBLE_LIMIT} visible`;
  elements.migrationsPill.textContent = `${migrations.length}/${COLUMN_VISIBLE_LIMIT} visible`;

  patchColumn('creates', elements.createsList, creates, 'No launchpad creates yet', 'Connect the stream and wait for public launch activity.');
  patchColumn('nearFill', elements.nearFillList, nearFill, 'No hot curves yet', 'Tokens close to fill will land here automatically.');
  patchColumn('migrations', elements.migrationsList, migrations, 'No migrations yet', 'Completed migrations will stay here for quick follow-up.');
}

function applySnapshot(snapshot) {
  state.latestSnapshot = snapshot;
  setSocketState(snapshot.socketState || 'offline');
  setStatus(snapshot.statusText || 'Waiting for stream data.', snapshot.socketState === 'online' ? 'ok' : snapshot.socketState === 'error' ? 'bad' : 'progress');
  renderCurrentSnapshot();
}

function clearSocketReconnectTimer() {
  if (state.socketReconnectTimer) {
    window.clearTimeout(state.socketReconnectTimer);
    state.socketReconnectTimer = null;
  }
}

function scheduleSocketReconnect() {
  clearSocketReconnectTimer();
  state.socketReconnectTimer = window.setTimeout(() => {
    startSnapshotStream();
  }, 1200);
}

function buildStreamSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/stream`;
}

async function readSocketFrame(data) {
  if (typeof data === 'string') {
    return data;
  }

  if (data instanceof Blob) {
    return data.text();
  }

  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }

  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data);
  }

  return '';
}

function startSnapshotStream() {
  clearSocketReconnectTimer();

  if (state.socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(state.socket.readyState)) {
    return;
  }

  if (state.socket) {
    state.socket.close();
  }

  const socket = new WebSocket(buildStreamSocketUrl());

  socket.addEventListener('open', () => {
    setStatus('Realtime relay connected. Waiting for launchpad flow...', 'progress');
  });

  socket.addEventListener('message', async (event) => {
    try {
      const rawFrame = await readSocketFrame(event.data);
      if (!rawFrame) {
        return;
      }

      const message = JSON.parse(rawFrame);
      if (message?.type === 'snapshot' && message.payload) {
        applySnapshot(message.payload);
      }
    } catch {
      setStatus('Realtime relay delivered an unreadable frame.', 'bad');
    }
  });

  socket.addEventListener('close', () => {
    if (state.socket === socket) {
      state.socket = null;
    }
    setStatus('Realtime relay disconnected. Reconnecting...', 'progress');
    scheduleSocketReconnect();
  });

  socket.addEventListener('error', () => {
    setStatus('Realtime relay error. Retrying...', 'bad');
  });

  state.socket = socket;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

function requirePhantom() {
  if (!window.solana || !window.solana.isPhantom) {
    throw new Error('Phantom wallet was not detected in this browser.');
  }

  return window.solana;
}

async function connectWallet() {
  try {
    setStatus('Connecting Phantom wallet...', 'progress');
    const provider = requirePhantom();
    const result = await provider.connect();
    const publicKey = result.publicKey.toBase58();
    elements.localPublicKey.value = publicKey;
    state.walletConnected = true;
    persistWalletPreference(true);
    renderWalletState();
    setStatus('Local wallet connected.', 'ok');
    showToast('Wallet connected', `Phantom ${shortenAddress(publicKey)} is ready for local trades.`);
  } catch (error) {
    setStatus(error.message, 'bad');
    showToast('Wallet connection failed', error.message, 'error');
  }
}

async function disconnectWallet() {
  try {
    const provider = requirePhantom();
    if (typeof provider.disconnect === 'function') {
      await provider.disconnect();
    }
  } catch {
    // Ignore provider disconnect issues and still clear local state.
  }

  state.walletConnected = false;
  elements.localPublicKey.value = '';
  persistWalletPreference(false);
  renderWalletState();
  setStatus('Local wallet disconnected.', 'progress');
  showToast('Wallet disconnected', 'Local Phantom mode is disconnected now.', 'success');
}

async function toggleWalletConnection() {
  if (state.walletConnected) {
    await disconnectWallet();
    return;
  }

  await connectWallet();
}

async function restoreWalletSession() {
  if (!shouldRestoreWallet()) {
    renderWalletState();
    return;
  }

  try {
    const provider = requirePhantom();
    const result = await provider.connect({ onlyIfTrusted: true });
    const publicKey = result?.publicKey?.toBase58?.();

    if (!publicKey) {
      throw new Error('Trusted Phantom session was not available.');
    }

    elements.localPublicKey.value = publicKey;
    state.walletConnected = true;
    persistWalletPreference(true);
  } catch {
    state.walletConnected = false;
    elements.localPublicKey.value = '';
    persistWalletPreference(false);
  }

  renderWalletState();
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function openModalForMint(mint) {
  const item = state.itemIndex.get(mint);
  if (!item) {
    return;
  }

  state.selectedMint = mint;
  elements.modalTitle.textContent = `${item.displayName || item.name || item.symbol || 'Token'} action deck`;
  elements.modalSubtitle.textContent = `${item.displayLaunchpad || item.launchpad || item.pool || 'n/a'} • risk ${normalizeRiskLabel(item)} • curve ${formatPercent(item.bondingCurveProgress)}`;

  if (item.imageUrl) {
    elements.modalImage.src = item.imageUrl;
    elements.modalImage.hidden = false;
  } else {
    elements.modalImage.hidden = true;
    elements.modalImage.removeAttribute('src');
  }

  const blocks = [
    ['Market cap', `${formatNumber(item.marketCapSol, 2)} SOL`],
    ['Curve', formatPercent(item.bondingCurveProgress)],
    ['Risk', normalizeRiskLabel(item)],
    ['Launchpad', item.displayLaunchpad || item.launchpad || item.pool || 'n/a']
  ];

  elements.modalMeta.innerHTML = blocks.map(([label, value]) => `
    <div class="meta-block">
      <span class="meta">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join('');

  elements.tradeModal.classList.add('is-open');
  elements.tradeModal.setAttribute('aria-hidden', 'false');
  updateTradeModeHint();
  renderPresetRackEditor();
}

function closeModal() {
  elements.tradeModal.classList.remove('is-open');
  elements.tradeModal.setAttribute('aria-hidden', 'true');
}

function updateTradeModeHint() {
  const isBuy = elements.tradeAction.value === 'buy';
  const isSolMode = elements.tradeDenominatedInSol.value === 'true';
  const modeLabel = state.activeDeskMode === 'local' ? 'Local Phantom' : 'Lightning';

  if (isBuy && isSolMode) {
    elements.tradeModeHint.textContent = `${modeLabel}: amount is treated as a SOL budget.`;
    return;
  }

  if (isBuy) {
    elements.tradeModeHint.textContent = `${modeLabel}: amount is treated as token units.`;
    return;
  }

  if (isSolMode) {
    elements.tradeModeHint.textContent = `${modeLabel}: amount is treated as a SOL-denominated exit target.`;
    return;
  }

  elements.tradeModeHint.textContent = `${modeLabel}: amount is treated as token units or a sell percentage like 25%.`;
}

async function submitTrade() {
  const item = state.itemIndex.get(state.selectedMint);
  if (!item) {
    setStatus('Select a token card first.', 'bad');
    return;
  }

  const payload = {
    action: elements.tradeAction.value,
    mint: item.mint,
    amount: elements.tradeAmount.value.trim(),
    denominatedInSol: elements.tradeDenominatedInSol.value === 'true',
    slippage: Number(elements.tradeSlippage.value || 5),
    pool: 'auto',
    priorityFeeSol: elements.tradePriorityFee.value ? Number(elements.tradePriorityFee.value) : undefined,
    jitoTip: elements.tradeJitoTip.value ? Number(elements.tradeJitoTip.value) : undefined,
    publicKey: elements.localPublicKey.value.trim() || undefined,
    memo: elements.tradeMemo.value.trim() || undefined
  };

  if (state.activeDeskMode === 'lightning') {
    const apiKey = elements.lightningApiKey.value.trim();
    if (!apiKey) {
      const message = 'Paste your Corto.Fun API key in the header before using Lightning mode.';
      setStatus(message, 'bad');
      showToast('Lightning key required', message, 'error');
      return;
    }

    try {
      setStatus('Submitting Lightning trade...', 'progress');
      const headers = { 'content-type': 'application/json' };
      if (apiKey) {
        headers['x-corto-user-api-key'] = apiKey;
      }

      const { response, body } = await requestJson('/api/lightning/trade', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok || body?.success === false) {
        const message = body?.error?.message || `HTTP ${response.status}`;
        setStatus(message, 'bad');
        showToast('Trade failed', message, 'error');
        return;
      }

      setStatus(`${payload.action === 'buy' ? 'Buy' : 'Sell'} sent through Lightning.`, 'ok');
      showToast(`${payload.action === 'buy' ? 'Buy' : 'Sell'} sent`, body.txSignature || 'Relay accepted the Lightning trade.');
      closeModal();
      return;
    } catch (error) {
      setStatus(error.message, 'bad');
      showToast('Trade failed', error.message, 'error');
      return;
    }
  }

  try {
    setStatus('Building local transaction for Phantom...', 'progress');
    const provider = requirePhantom();
    if (!payload.publicKey) {
      const wallet = await provider.connect();
      payload.publicKey = wallet.publicKey.toBase58();
      elements.localPublicKey.value = payload.publicKey;
      state.walletConnected = true;
      persistWalletPreference(true);
      renderWalletState();
    }

    const { response, body } = await requestJson('/api/local/build-trade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok || body?.success === false) {
      const message = body?.error?.message || `HTTP ${response.status}`;
      setStatus(message, 'bad');
      showToast('Local trade failed', message, 'error');
      return;
    }

    if (!body.transaction) {
      throw new Error('Local trade did not return a transaction to sign.');
    }

    const transaction = window.solanaWeb3.VersionedTransaction.deserialize(base64ToBytes(body.transaction));
    const signed = await provider.signAndSendTransaction(transaction);
    setStatus(`${payload.action === 'buy' ? 'Buy' : 'Sell'} signed with Phantom.`, 'ok');
    showToast(`${payload.action === 'buy' ? 'Buy' : 'Sell'} sent`, signed.signature || 'Signed and broadcast from Phantom.');
    closeModal();
  } catch (error) {
    setStatus(error.message, 'bad');
    showToast('Local trade failed', error.message, 'error');
  }
}

async function loadRuntime() {
  const { body } = await requestJson('/api/runtime');
  state.runtime = body.runtime;
  state.capabilities = body.capabilities;
  setSocketState('offline');
  setStatus('Relay is preparing live launchpad data.', 'progress');
  loadDeskMode();
  loadQuickPresets();
  loadLightningApiKey();
  loadColumnFilters();
  renderQuickButtons();
  renderPresetRackEditor();
  renderColumnFilters('creates');
  renderColumnFilters('nearFill');
  renderColumnFilters('migrations');
  renderDeskMode();
  renderWalletState();
  await restoreWalletSession();
  renderEmptyState(elements.createsList, 'No launchpad creates yet', 'The latest create flow will appear here automatically.');
  renderEmptyState(elements.nearFillList, 'No hot curves yet', 'Near-fill pressure will collect here automatically.');
  renderEmptyState(elements.migrationsList, 'No migrations yet', 'Recent migrations will collect here automatically.');
}

elements.deskModeLightningButton.addEventListener('click', () => setDeskMode('lightning'));
elements.deskModeLocalButton.addEventListener('click', () => setDeskMode('local'));
elements.headerConnectWalletButton.addEventListener('click', toggleWalletConnection);
elements.lightningApiKey.addEventListener('change', persistLightningApiKey);
elements.lightningApiKey.addEventListener('blur', persistLightningApiKey);
elements.lightningApiKey.addEventListener('input', persistLightningApiKey);
elements.togglePresetRackButton.addEventListener('click', togglePresetRackEditor);
elements.tradeAction.addEventListener('change', updateTradeModeHint);
elements.tradeDenominatedInSol.addEventListener('change', updateTradeModeHint);
elements.submitTradeButton.addEventListener('click', submitTrade);
elements.closeModalButton.addEventListener('click', closeModal);
elements.tradeModal.addEventListener('click', (event) => {
  if (event.target === elements.tradeModal) {
    closeModal();
  }
});

document.addEventListener('click', (event) => {
  const filterButton = event.target.closest('[data-column][data-launchpad]');
  if (filterButton) {
    toggleLaunchpadFilter(filterButton.dataset.column, filterButton.dataset.launchpad);
    return;
  }

  const openButton = event.target.closest('[data-open-mint]');
  if (openButton) {
    openModalForMint(openButton.dataset.openMint);
    return;
  }

  const presetButton = event.target.closest('[data-preset-slot]');
  if (presetButton) {
    const preset = state.quickPresets[Number(presetButton.dataset.presetSlot)];
    if (preset) {
      elements.tradeAmount.value = preset.amount;
    }
  }
});

elements.presetRackEditor.addEventListener('change', (event) => {
  if (event.target instanceof HTMLInputElement) {
    updatePresetFromEditor(event.target);
  }
});

loadRuntime()
  .then(() => {
    startSnapshotStream();
  })
  .catch((error) => {
    setSocketState('error');
    setStatus(error.message, 'bad');
    showToast('Runtime error', error.message, 'error');
  });