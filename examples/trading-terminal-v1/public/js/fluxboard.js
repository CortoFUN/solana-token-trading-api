const PRESET_STORAGE_KEY = 'corto-fluxboard-trade-hotkeys-v20260405';
const LIGHTNING_API_KEY_STORAGE = 'corto-fluxboard-lightning-api-key-v20260402';
const DESK_MODE_STORAGE_KEY = 'corto-fluxboard-desk-mode-v20260402';
const LOCAL_WALLET_STATE_STORAGE_KEY = 'corto-fluxboard-local-wallet-state-v20260402';
const COLUMN_FILTERS_STORAGE_KEY = 'corto-fluxboard-column-filters-v20260402';
const TRADE_PANEL_STORAGE_KEY = 'corto-fluxboard-trade-panel-v20260405';
const DEFAULT_PRESET_LIBRARY = Object.freeze({
  buy: Object.freeze([
    Object.freeze({ id: 'tap', label: 'Tap', value: '0.03' }),
    Object.freeze({ id: 'scout', label: 'Scout', value: '0.05' }),
    Object.freeze({ id: 'probe', label: 'Probe', value: '0.10' }),
    Object.freeze({ id: 'push', label: 'Push', value: '0.25' }),
    Object.freeze({ id: 'sweep', label: 'Sweep', value: '0.50' }),
    Object.freeze({ id: 'send', label: 'Send', value: '1.00' })
  ]),
  sell: Object.freeze([
    Object.freeze({ id: 'trim', label: 'Trim', value: '10%' }),
    Object.freeze({ id: 'fade', label: 'Fade', value: '25%' }),
    Object.freeze({ id: 'cut', label: 'Cut', value: '50%' }),
    Object.freeze({ id: 'peel', label: 'Peel', value: '75%' }),
    Object.freeze({ id: 'flush', label: 'Flush', value: '100%' }),
    Object.freeze({ id: 'dust', label: 'Dust', value: '5%' })
  ])
});
const DEFAULT_LAUNCHPADS = ['raydium-launchlab', 'pump.fun', 'meteora-dbc', 'letsbonk.fun'];
const COLUMN_VISIBLE_LIMIT = 8;

function formatLaunchpadLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'raydium-launchlab') {
    return 'Raydium';
  }

  if (normalized === 'pump.fun') {
    return 'Pump';
  }

  if (normalized === 'meteora-dbc') {
    return 'Meteora';
  }

  if (normalized === 'letsbonk.fun') {
    return 'LetsBonk';
  }

  return String(value || '').trim() || 'Unknown';
}

function getLaunchpadToneClass(value, baseClass) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'pump.fun' || normalized === 'pump' || normalized.includes('pump')) {
    return `${baseClass} ${baseClass}-pump`;
  }

  if (normalized === 'letsbonk.fun' || normalized === 'letsbonk' || normalized.includes('bonk')) {
    return `${baseClass} ${baseClass}-bonk`;
  }

  if (normalized === 'raydium-launchlab' || normalized.includes('raydium')) {
    return `${baseClass} ${baseClass}-raydium`;
  }

  if (normalized === 'meteora-dbc' || normalized.includes('meteora')) {
    return `${baseClass} ${baseClass}-meteora`;
  }

  return baseClass;
}

function getModalLaunchpadToneClass(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'pump.fun' || normalized === 'pump' || normalized.includes('pump')) {
    return 'modal-pill-launchpad-pump';
  }

  if (normalized === 'letsbonk.fun' || normalized === 'letsbonk' || normalized.includes('bonk')) {
    return 'modal-pill-launchpad-bonk';
  }

  if (normalized === 'raydium-launchlab' || normalized.includes('raydium')) {
    return 'modal-pill-launchpad-raydium';
  }

  if (normalized === 'meteora-dbc' || normalized.includes('meteora')) {
    return 'modal-pill-launchpad-meteora';
  }

  return 'modal-pill-launchpad-sky';
}

function buildDefaultLaunchpadEntries() {
  return DEFAULT_LAUNCHPADS.map((id) => ({ id, label: formatLaunchpadLabel(id) }));
}

function cloneDefaultPresetLibrary() {
  return {
    buy: DEFAULT_PRESET_LIBRARY.buy.map((preset) => ({ ...preset })),
    sell: DEFAULT_PRESET_LIBRARY.sell.map((preset) => ({ ...preset }))
  };
}

const state = {
  runtime: null,
  capabilities: null,
  selectedMint: '',
  selectedMintSnapshot: null,
  modalTradeTape: [],
  modalTradeFeedTimer: null,
  modalTradeFeedRequestedMint: '',
  modalMintCopiedTimer: null,
  tradePresets: cloneDefaultPresetLibrary(),
  tradePresetActiveSlot: {
    buy: null,
    sell: null
  },
  presetEditorOpen: false,
  activeDeskMode: 'lightning',
  tradeAmountModeByAction: {
    buy: 'sol',
    sell: 'percent'
  },
  priorityMode: 'auto',
  jitoMode: 'auto',
  availableLaunchpads: buildDefaultLaunchpadEntries(),
  columnLaunchpads: {
    creates: new Set(DEFAULT_LAUNCHPADS),
    nearFill: new Set(DEFAULT_LAUNCHPADS),
    migrations: new Set(DEFAULT_LAUNCHPADS)
  },
  socket: null,
  socketState: 'offline',
  socketReconnectTimer: null,
  itemIndex: new Map(),
  columns: {
    creates: new Map(),
    nearFill: new Map(),
    migrations: new Map()
  },
  initializedColumns: new Set(),
  walletConnected: false,
  relayActionPending: false
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
  streamConnectButton: document.getElementById('streamConnectButton'),
  streamDisconnectButton: document.getElementById('streamDisconnectButton'),
  toastStack: document.getElementById('toastStack'),
  tradeModal: document.getElementById('tradeModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalSubtitle: document.getElementById('modalSubtitle'),
  modalImage: document.getElementById('modalImage'),
  modalMeta: document.getElementById('modalMeta'),
  modalLaunchpadBadge: document.getElementById('modalLaunchpadBadge'),
  modalRiskBadge: document.getElementById('modalRiskBadge'),
  modalCurveBadge: document.getElementById('modalCurveBadge'),
  modalMintRow: document.getElementById('modalMintRow'),
  modalMint: document.getElementById('modalMint'),
  copyMintButton: document.getElementById('copyMintButton'),
  modalLiveStamp: document.getElementById('modalLiveStamp'),
  modalTradeFeedStatus: document.getElementById('modalTradeFeedStatus'),
  modalTradeFeedCount: document.getElementById('modalTradeFeedCount'),
  modalTradeFeedList: document.getElementById('modalTradeFeedList'),
  closeModalButton: document.getElementById('closeModalButton'),
  quickPresetLabel: document.getElementById('quickPresetLabel'),
  quickButtons: document.getElementById('quickButtons'),
  togglePresetRackButton: document.getElementById('togglePresetRackButton'),
  presetRackEditor: document.getElementById('presetRackEditor'),
  tradeAction: document.getElementById('tradeAction'),
  tradeActionBuyButton: document.getElementById('tradeActionBuyButton'),
  tradeActionSellButton: document.getElementById('tradeActionSellButton'),
  tradeAmountMode: document.getElementById('tradeAmountMode'),
  tradeAmountModePrimaryButton: document.getElementById('tradeAmountModePrimaryButton'),
  tradeAmountModeSecondaryButton: document.getElementById('tradeAmountModeSecondaryButton'),
  tradeAmount: document.getElementById('tradeAmount'),
  tradeDenominatedInSol: document.getElementById('tradeDenominatedInSol'),
  tradeSlippage: document.getElementById('tradeSlippage'),
  tradePriorityModeAutoButton: document.getElementById('tradePriorityModeAutoButton'),
  tradePriorityModeCustomButton: document.getElementById('tradePriorityModeCustomButton'),
  tradePriorityFee: document.getElementById('tradePriorityFee'),
  tradeJitoModeOffButton: document.getElementById('tradeJitoModeOffButton'),
  tradeJitoModeAutoButton: document.getElementById('tradeJitoModeAutoButton'),
  tradeJitoModeCustomButton: document.getElementById('tradeJitoModeCustomButton'),
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

function normalizeDecimalInput(value) {
  return String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.');
}

function sanitizePresetLabel(value, fallback) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
  return normalized.slice(0, 14) || fallback;
}

function formatTradeNumber(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }

  if (value >= 100) {
    return value.toFixed(0);
  }

  if (value >= 1) {
    return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  if (value >= 0.1) {
    return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  }

  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function parseFlexiblePositiveNumber(value) {
  const normalized = normalizeDecimalInput(value).replace(/%$/, '');
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getCurrentTradeAction() {
  return elements.tradeAction.value === 'sell' ? 'sell' : 'buy';
}

function getCurrentTradeAmountMode() {
  const value = String(elements.tradeAmountMode.value || '').trim();
  return value || (getCurrentTradeAction() === 'sell' ? 'percent' : 'sol');
}

function sanitizePresetValue(value, action, fallback) {
  const parsed = parseFlexiblePositiveNumber(value);
  if (parsed === null) {
    return fallback;
  }

  if (action === 'sell') {
    return `${formatTradeNumber(Math.min(parsed, 100))}%`;
  }

  return formatTradeNumber(parsed);
}

function normalizeTradeAmountInput(rawValue) {
  const action = getCurrentTradeAction();
  const amountMode = getCurrentTradeAmountMode();
  const parsed = parseFlexiblePositiveNumber(rawValue);

  if (parsed === null) {
    return {
      error: action === 'sell' ? 'Enter a valid sell size or percent.' : 'Enter a valid buy size.'
    };
  }

  if (action === 'sell' && amountMode === 'percent') {
    if (parsed > 100) {
      return {
        error: 'Sell percent cannot be greater than 100%.'
      };
    }

    const normalizedPercent = `${formatTradeNumber(parsed)}%`;
    return {
      value: normalizedPercent,
      displayValue: normalizedPercent
    };
  }

  const normalizedNumber = formatTradeNumber(parsed);
  return {
    value: normalizedNumber,
    displayValue: normalizedNumber
  };
}

function getTradePresetsForAction(action = getCurrentTradeAction()) {
  return state.tradePresets[action] || [];
}

function setSocketState(nextState) {
  state.socketState = nextState;
  document.body.dataset.socketState = nextState;
  renderRelayControls();
}

function setStatus(message, tone = 'progress') {
  elements.statusText.hidden = false;
  elements.statusText.textContent = message;
  elements.statusText.className = `desk-status ${tone === 'ok' ? 'tone-ok' : tone === 'bad' ? 'tone-bad' : 'tone-progress'}`;
}

function getAvailableLaunchpadIds() {
  return state.availableLaunchpads.map((entry) => entry.id);
}

function setAvailableLaunchpads(entries) {
  const nextCatalog = new Map();

  [...buildDefaultLaunchpadEntries(), ...(Array.isArray(entries) ? entries : [])].forEach((entry) => {
    const id = String(entry?.id || '').trim().toLowerCase();
    if (!id) {
      return;
    }

    nextCatalog.set(id, {
      id,
      label: String(entry?.label || '').trim() || formatLaunchpadLabel(id)
    });
  });

  state.availableLaunchpads = [...nextCatalog.values()];

  const allowedIds = new Set(getAvailableLaunchpadIds());

  ['creates', 'nearFill', 'migrations'].forEach((columnKey) => {
    const nextValues = [...state.columnLaunchpads[columnKey]].filter((value) => allowedIds.has(value));
    state.columnLaunchpads[columnKey] = new Set(nextValues.length ? nextValues : getAvailableLaunchpadIds());
  });
}

function showToast(title, message, tone = 'success', options = {}) {
  const linkMarkup = options?.linkHref && options?.linkLabel
    ? `<a class="toast-link" href="${escapeHtml(options.linkHref)}" target="_blank" rel="noreferrer noopener">${escapeHtml(options.linkLabel)}</a>`
    : '';
  const detailMarkup = options?.detail
    ? `<span class="toast-detail">${escapeHtml(options.detail)}</span>`
    : '';
  const durationMs = Number.isFinite(options?.durationMs)
    ? options.durationMs
    : tone === 'error'
      ? 6400
      : 4600;

  const toast = document.createElement('article');
  toast.className = `toast toast-${tone}`;
  toast.innerHTML = `
    <div class="toast-copy">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(message)}</span>
      ${detailMarkup}
    </div>
    ${linkMarkup}
  `;
  elements.toastStack.prepend(toast);

  window.setTimeout(() => {
    toast.remove();
  }, durationMs);
}

function resetMintCopyState() {
  if (state.modalMintCopiedTimer) {
    window.clearTimeout(state.modalMintCopiedTimer);
    state.modalMintCopiedTimer = null;
  }

  elements.modalMintRow?.classList.remove('is-copied');
  elements.copyMintButton?.classList.remove('is-copied');
}

async function copySelectedMint() {
  const item = getSelectedTokenItem();
  const mint = String(item?.mint || '').trim();
  if (!mint) {
    return;
  }

  try {
    await navigator.clipboard.writeText(mint);
    resetMintCopyState();
    elements.modalMintRow?.classList.add('is-copied');
    elements.copyMintButton?.classList.add('is-copied');
    state.modalMintCopiedTimer = window.setTimeout(() => {
      elements.modalMintRow?.classList.remove('is-copied');
      elements.copyMintButton?.classList.remove('is-copied');
      state.modalMintCopiedTimer = null;
    }, 900);
  } catch (error) {
    showToast('Copy failed', error.message || 'Clipboard is unavailable.', 'error');
  }
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

  const allowedLaunchpads = new Set(getAvailableLaunchpadIds());

  try {
    const parsed = JSON.parse(raw);
    ['creates', 'nearFill', 'migrations'].forEach((columnKey) => {
      const values = Array.isArray(parsed?.[columnKey]) ? parsed[columnKey].filter((value) => allowedLaunchpads.has(value)) : null;
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
  renderFeeControls();
  updateTradeModeHint();
}

function setDeskMode(mode) {
  state.activeDeskMode = mode === 'local' ? 'local' : 'lightning';
  renderDeskMode();
}

function loadQuickPresets() {
  const raw = localStorage.getItem(PRESET_STORAGE_KEY);
  if (!raw) {
    state.tradePresets = cloneDefaultPresetLibrary();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.tradePresets = {
        buy: cloneDefaultPresetLibrary().buy.map((fallbackPreset, index) => ({
          ...fallbackPreset,
          label: sanitizePresetLabel(parsed[index]?.label, fallbackPreset.label),
          value: sanitizePresetValue(parsed[index]?.amount, 'buy', fallbackPreset.value)
        })),
        sell: cloneDefaultPresetLibrary().sell.map((fallbackPreset) => ({ ...fallbackPreset }))
      };
      return;
    }

    if (parsed && typeof parsed === 'object') {
      const fallbackLibrary = cloneDefaultPresetLibrary();
      state.tradePresets = {
        buy: fallbackLibrary.buy.map((fallbackPreset, index) => ({
          ...fallbackPreset,
          label: sanitizePresetLabel(parsed?.buy?.[index]?.label, fallbackPreset.label),
          value: sanitizePresetValue(parsed?.buy?.[index]?.value, 'buy', fallbackPreset.value)
        })),
        sell: fallbackLibrary.sell.map((fallbackPreset, index) => ({
          ...fallbackPreset,
          label: sanitizePresetLabel(parsed?.sell?.[index]?.label, fallbackPreset.label),
          value: sanitizePresetValue(parsed?.sell?.[index]?.value, 'sell', fallbackPreset.value)
        }))
      };
      return;
    }
  } catch {
    state.tradePresets = cloneDefaultPresetLibrary();
    return;
  }

  state.tradePresets = cloneDefaultPresetLibrary();
}

function saveTradePanelConfig() {
  localStorage.setItem(TRADE_PANEL_STORAGE_KEY, JSON.stringify({
    tradeAmountModeByAction: state.tradeAmountModeByAction,
    priorityMode: state.priorityMode,
    jitoMode: state.jitoMode
  }));
}

function loadTradePanelConfig() {
  const raw = localStorage.getItem(TRADE_PANEL_STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.tradeAmountModeByAction?.buy === 'token') {
      state.tradeAmountModeByAction.buy = 'token';
    }
    if (['percent', 'token'].includes(parsed?.tradeAmountModeByAction?.sell)) {
      state.tradeAmountModeByAction.sell = parsed.tradeAmountModeByAction.sell;
    }
    if (['auto', 'custom'].includes(parsed?.priorityMode)) {
      state.priorityMode = parsed.priorityMode;
    }
    if (['off', 'auto', 'custom'].includes(parsed?.jitoMode)) {
      state.jitoMode = parsed.jitoMode;
    }
  } catch {
    return;
  }
}

function saveQuickPresets() {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(state.tradePresets));
  renderQuickButtons();
}

function persistQuickPresets() {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(state.tradePresets));
}

function renderQuickButtons() {
  const action = getCurrentTradeAction();
  const activeSlot = state.tradePresetActiveSlot[action];
  elements.quickButtons.dataset.action = action;
  elements.quickButtons.classList.toggle('is-editing', state.presetEditorOpen);

  elements.quickButtons.innerHTML = getTradePresetsForAction(action).map((preset, index) => {
    if (state.presetEditorOpen) {
      return `
        <div class="quick-chip quick-chip-${escapeHtml(action)}${activeSlot === index ? ' is-active' : ''} is-editable" data-preset-slot="${index}">
          <span class="quick-chip-hotkey">${index + 1}</span>
          ${action === 'sell'
            ? `<span class="quick-chip-input-shell"><input class="quick-chip-input" type="text" inputmode="decimal" value="${escapeHtml(String(preset.value).replace(/%$/, ''))}" data-inline-preset-value="${index}" aria-label="Preset ${index + 1} percent" /><span class="quick-chip-suffix">%</span></span>`
            : `<input class="quick-chip-input" type="text" inputmode="decimal" value="${escapeHtml(preset.value)}" data-inline-preset-value="${index}" aria-label="Preset ${index + 1} value" />`}
        </div>
      `;
    }

    return `
      <button type="button" class="quick-chip quick-chip-${escapeHtml(action)}${activeSlot === index ? ' is-active' : ''}" data-preset-slot="${index}">
        <span class="quick-chip-hotkey">${index + 1}</span>
        <span class="quick-chip-main">${escapeHtml(preset.value)}</span>
      </button>
    `;
  }).join('');

  elements.quickPresetLabel.textContent = action === 'sell' ? 'Sell hotkeys' : 'Buy hotkeys';
}

function renderPresetRackEditor() {
  elements.togglePresetRackButton.innerHTML = '&#9998;';
  elements.togglePresetRackButton.classList.toggle('is-active', state.presetEditorOpen);
}

function togglePresetRackEditor() {
  state.presetEditorOpen = !state.presetEditorOpen;
  renderPresetRackEditor();
  renderQuickButtons();
}

function updatePresetFromEditor(target) {
  const action = getCurrentTradeAction();
  const presetSet = getTradePresetsForAction(action);
  const inlineValueIndex = target.dataset.inlinePresetValue;
  if (inlineValueIndex !== undefined) {
    const fallback = DEFAULT_PRESET_LIBRARY[action][Number(inlineValueIndex)];
    const normalizedInput = normalizeDecimalInput(target.value).replace(/[^0-9.]/g, '');
    target.value = normalizedInput;
    const normalizedPresetValue = sanitizePresetValue(normalizedInput, action, fallback.value);
    presetSet[Number(inlineValueIndex)].value = normalizedPresetValue;
    persistQuickPresets();
    return;
  }

  const labelIndex = target.dataset.presetLabel;
  if (labelIndex !== undefined) {
    const fallback = DEFAULT_PRESET_LIBRARY[action][Number(labelIndex)];
    presetSet[Number(labelIndex)].label = sanitizePresetLabel(target.value, fallback.label);
    saveQuickPresets();
    return;
  }

  const valueIndex = target.dataset.presetValue;
  if (valueIndex !== undefined) {
    const fallback = DEFAULT_PRESET_LIBRARY[action][Number(valueIndex)];
    presetSet[Number(valueIndex)].value = sanitizePresetValue(target.value, action, fallback.value);
    saveQuickPresets();
  }
}

function renderActionSwitch() {
  const action = getCurrentTradeAction();
  elements.tradeActionBuyButton.classList.toggle('is-active', action === 'buy');
  elements.tradeActionSellButton.classList.toggle('is-active', action === 'sell');
  elements.submitTradeButton.textContent = action === 'sell' ? 'Send sell' : 'Send buy';
}

function syncTradeHiddenFields() {
  const action = getCurrentTradeAction();
  const amountMode = state.tradeAmountModeByAction[action];
  elements.tradeAmountMode.value = amountMode;
  elements.tradeDenominatedInSol.value = action === 'buy' && amountMode === 'sol' ? 'true' : 'false';
}

function renderAmountModeSwitch() {
  const action = getCurrentTradeAction();
  const amountMode = getCurrentTradeAmountMode();
  const primaryLabel = action === 'sell' ? '%' : 'SOL';
  const secondaryLabel = 'Token';
  const primaryValue = action === 'sell' ? 'percent' : 'sol';

  elements.tradeAmountModePrimaryButton.textContent = primaryLabel;
  elements.tradeAmountModeSecondaryButton.textContent = secondaryLabel;
  elements.tradeAmountModePrimaryButton.classList.toggle('is-active', amountMode === primaryValue);
  elements.tradeAmountModeSecondaryButton.classList.toggle('is-active', amountMode === 'token');
}

function renderFeeControls() {
  elements.tradePriorityModeAutoButton.classList.toggle('is-active', state.priorityMode === 'auto');
  elements.tradePriorityModeCustomButton.classList.toggle('is-active', state.priorityMode === 'custom');
  elements.tradePriorityFee.hidden = state.priorityMode !== 'custom';

  const jitoDisabledForLocal = state.activeDeskMode === 'local';
  const resolvedJitoMode = jitoDisabledForLocal ? 'off' : state.jitoMode;
  elements.tradeJitoModeOffButton.classList.toggle('is-active', resolvedJitoMode === 'off');
  elements.tradeJitoModeAutoButton.classList.toggle('is-active', resolvedJitoMode === 'auto');
  elements.tradeJitoModeCustomButton.classList.toggle('is-active', resolvedJitoMode === 'custom');
  elements.tradeJitoModeOffButton.disabled = jitoDisabledForLocal;
  elements.tradeJitoModeAutoButton.disabled = jitoDisabledForLocal;
  elements.tradeJitoModeCustomButton.disabled = jitoDisabledForLocal;
  elements.tradeJitoTip.hidden = resolvedJitoMode !== 'custom';
}

function setTradeAction(action) {
  const nextAction = action === 'sell' ? 'sell' : 'buy';
  elements.tradeAction.value = nextAction;
  syncTradeHiddenFields();
  renderActionSwitch();
  renderAmountModeSwitch();
  renderQuickButtons();
  renderFeeControls();
  updateTradeModeHint();
}

function setTradeAmountMode(mode) {
  const action = getCurrentTradeAction();
  const nextMode = action === 'sell'
    ? (mode === 'token' ? 'token' : 'percent')
    : (mode === 'token' ? 'token' : 'sol');

  state.tradeAmountModeByAction[action] = nextMode;
  syncTradeHiddenFields();
  saveTradePanelConfig();
  renderAmountModeSwitch();
  updateTradeModeHint();
}

function setPriorityMode(mode) {
  state.priorityMode = mode === 'custom' ? 'custom' : 'auto';
  saveTradePanelConfig();
  renderFeeControls();
}

function setJitoMode(mode) {
  state.jitoMode = ['off', 'custom'].includes(mode) ? mode : 'auto';
  saveTradePanelConfig();
  renderFeeControls();
}

function applyPreset(slotIndex) {
  const action = getCurrentTradeAction();
  const preset = getTradePresetsForAction(action)[slotIndex];
  if (!preset) {
    return;
  }

  state.tradePresetActiveSlot[action] = slotIndex;
  if (action === 'sell') {
    setTradeAmountMode('percent');
  } else {
    setTradeAmountMode('sol');
  }

  elements.tradeAmount.value = preset.value;
  renderQuickButtons();
}

function renderColumnFilters(columnKey) {
  const container = elements[`${columnKey}FilterRow`];
  const selectedLaunchpads = state.columnLaunchpads[columnKey];

  if (!container) {
    return;
  }

  container.innerHTML = state.availableLaunchpads.map((entry) => `
    <button class="${getLaunchpadToneClass(entry.id, 'pool-chip')}${selectedLaunchpads.has(entry.id) ? ' is-active' : ''}" type="button" data-column="${escapeHtml(columnKey)}" data-launchpad="${escapeHtml(entry.id)}">${escapeHtml(entry.label)}</button>
  `).join('');

  container.querySelectorAll('[data-launchpad]').forEach((button) => {
    button.classList.toggle('is-active', selectedLaunchpads.has(button.dataset.launchpad));
  });
}

function renderRelayControls() {
  const isBusy = state.relayActionPending;
  const socketState = state.socketState || 'offline';

  if (elements.streamConnectButton) {
    elements.streamConnectButton.disabled = isBusy || socketState === 'connecting';
  }

  if (elements.streamDisconnectButton) {
    elements.streamDisconnectButton.disabled = isBusy || socketState === 'offline';
  }
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
    <div class="stream-copy">
      <div class="stream-title-row">
        <img class="stream-image" alt="Token preview" hidden />
        <div class="stream-token-copy">
          <strong class="stream-name"></strong>
          <span class="stream-symbol"></span>
        </div>
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
  launchpad.className = getLaunchpadToneClass(item.launchpad || item.pool || '', 'stream-launchpad');
  launchpad.textContent = item.displayLaunchpad || formatLaunchpadLabel(item.launchpad || item.pool || '') || '';
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

  curve.className = 'inline-stat card-curve';
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
  (snapshot.items || []).forEach((item) => {
    state.itemIndex.set(item.mint, item);
  });

  elements.createsPill.textContent = `${creates.length}/${COLUMN_VISIBLE_LIMIT} visible`;
  elements.nearFillPill.textContent = `${nearFill.length}/${COLUMN_VISIBLE_LIMIT} visible`;
  elements.migrationsPill.textContent = `${migrations.length}/${COLUMN_VISIBLE_LIMIT} visible`;

  patchColumn('creates', elements.createsList, creates, 'No launchpad creates yet', 'Connect the stream and wait for public launch activity.');
  patchColumn('nearFill', elements.nearFillList, nearFill, 'No hot curves yet', 'Tokens close to fill will land here automatically.');
  patchColumn('migrations', elements.migrationsList, migrations, 'No migrations yet', 'Completed migrations will stay here for quick follow-up.');

  if (elements.tradeModal.classList.contains('is-open') && state.selectedMint) {
    renderSelectedTokenModal();
  }
}

function applySnapshot(snapshot) {
  state.latestSnapshot = snapshot;
  setSocketState(snapshot.socketState || 'offline');
  setStatus(snapshot.statusText || 'Waiting for stream data.', snapshot.socketState === 'online' ? 'ok' : snapshot.socketState === 'error' ? 'bad' : 'progress');
  renderCurrentSnapshot();
}

async function updateRelayConnection(path, pendingMessage, successMessage) {
  try {
    state.relayActionPending = true;
    renderRelayControls();
    setStatus(pendingMessage, 'progress');
    const { response, body } = await requestJson(path, { method: 'POST' });

    if (!response.ok || body?.success === false) {
      throw new Error(body?.error?.message || `HTTP ${response.status}`);
    }

    setStatus(successMessage, 'ok');
  } catch (error) {
    setStatus(error.message, 'bad');
    showToast('Relay command failed', error.message, 'error');
  } finally {
    state.relayActionPending = false;
    renderRelayControls();
  }
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
    if (state.selectedMint) {
      subscribeModalTradeFeed(state.selectedMint);
    }
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
        return;
      }

      if (message?.type === 'trade_tape' && message.payload?.mint === state.selectedMint && message.payload?.entry) {
        handleIncomingTradeTapeEntry(message.payload.entry);
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
    if (state.selectedMint) {
      setModalTradeFeedStatus('Relay disconnected. Waiting to reconnect live trades...');
    }
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

function formatLiveAge(timestampMs) {
  const parsed = parseNumber(timestampMs);
  if (parsed === null) {
    return 'Live status pending';
  }

  const deltaSeconds = Math.max(0, Math.round((Date.now() - parsed) / 1000));
  if (deltaSeconds < 3) {
    return 'Live now';
  }
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }

  const deltaMinutes = Math.round(deltaSeconds / 60);
  return `${deltaMinutes}m ago`;
}

function formatTradeTapeAge(timestampMs) {
  const parsed = parseNumber(timestampMs);
  if (parsed === null) {
    return 'n/a';
  }

  const deltaSeconds = Math.max(0, Math.round((Date.now() - parsed) / 1000));
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }

  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  return `${deltaHours}h ago`;
}

function buildSolscanUrl(signature) {
  return `https://solscan.io/tx/${encodeURIComponent(signature)}`;
}

function getTradeTapeToneClass(entry) {
  const type = String(entry?.txType || '').toLowerCase();
  return type === 'sell' ? 'modal-trade-item-sell' : 'modal-trade-item-buy';
}

function formatTradeTapeAmount(entry) {
  const amountSol = parseNumber(entry?.amountSol);
  if (amountSol === null) {
    return 'n/a';
  }

  return `${formatTradeNumber(amountSol)} SOL`;
}

function renderModalTradeFeed() {
  if (!elements.modalTradeFeedList || !elements.modalTradeFeedCount) {
    return;
  }

  const trades = Array.isArray(state.modalTradeTape) ? state.modalTradeTape : [];
  elements.modalTradeFeedCount.textContent = `${trades.length} events`;

  if (!trades.length) {
    elements.modalTradeFeedList.innerHTML = '<div class="result-empty">No live trades for this token yet.</div>';
    return;
  }

  elements.modalTradeFeedList.innerHTML = trades.map((entry) => {
    const signature = String(entry?.signature || '').trim();
    const signatureMarkup = signature
      ? `<a class="modal-trade-link" href="${buildSolscanUrl(signature)}" target="_blank" rel="noreferrer noopener">${escapeHtml(shortenAddress(signature))}</a>`
      : '<span class="modal-trade-link is-muted">pending</span>';

    return `
      <article class="modal-trade-item ${getTradeTapeToneClass(entry)}">
        <div class="modal-trade-main">
          <span class="modal-trade-age">${escapeHtml(formatTradeTapeAge(entry?.timestampMs))}</span>
          <span class="modal-trade-wallet">${escapeHtml(shortenAddress(entry?.trader || 'unknown'))}</span>
          <span class="modal-trade-amount">${escapeHtml(formatTradeTapeAmount(entry))}</span>
          <span class="modal-trade-cap">${escapeHtml(formatMarketCapUsd(entry?.marketCapUsd))}</span>
        </div>
        <div class="modal-trade-sideband">
          <span class="modal-trade-side">${escapeHtml(String(entry?.txType || 'trade').toUpperCase())}</span>
          ${signatureMarkup}
        </div>
      </article>
    `;
  }).join('');
}

function setModalTradeFeedStatus(message) {
  if (elements.modalTradeFeedStatus) {
    elements.modalTradeFeedStatus.textContent = message;
  }
}

function clearModalTradeFeedTimer() {
  if (state.modalTradeFeedTimer) {
    window.clearInterval(state.modalTradeFeedTimer);
    state.modalTradeFeedTimer = null;
  }
}

function startModalTradeFeedTimer() {
  clearModalTradeFeedTimer();

  if (!state.selectedMint) {
    return;
  }

  state.modalTradeFeedTimer = window.setInterval(() => {
    renderModalTradeFeed();
  }, 1000);
}

function subscribeModalTradeFeed(mint) {
  state.modalTradeFeedRequestedMint = mint || '';

  if (!state.modalTradeFeedRequestedMint || !state.socket || state.socket.readyState !== WebSocket.OPEN) {
    return;
  }

  state.socket.send(JSON.stringify({
    type: 'subscribe_trades',
    mint: state.modalTradeFeedRequestedMint
  }));
}

function unsubscribeModalTradeFeed() {
  if (state.modalTradeFeedRequestedMint && state.socket && state.socket.readyState === WebSocket.OPEN) {
    state.socket.send(JSON.stringify({ type: 'unsubscribe_trades' }));
  }

  state.modalTradeFeedRequestedMint = '';
}

async function loadModalTradeFeed(mint) {
  state.modalTradeTape = [];
  renderModalTradeFeed();
  setModalTradeFeedStatus('Loading the last 50 live trades for this token...');

  try {
    const { response, body } = await requestJson(`/api/stream/trades/${encodeURIComponent(mint)}`);
    if (mint !== state.selectedMint) {
      return;
    }

    if (!response.ok || body?.success === false) {
      const message = body?.error?.message || `HTTP ${response.status}`;
      setModalTradeFeedStatus(message);
      return;
    }

    state.modalTradeTape = Array.isArray(body?.trades) ? body.trades : [];
    renderModalTradeFeed();
    setModalTradeFeedStatus(state.modalTradeTape.length
      ? 'Live updates stay active only while this modal remains open.'
      : 'Waiting for the first live trades on this token.');
  } catch (error) {
    if (mint === state.selectedMint) {
      setModalTradeFeedStatus(error.message || 'Failed to load live trades.');
    }
  }
}

function handleIncomingTradeTapeEntry(entry) {
  if (!entry || !state.selectedMint) {
    return;
  }

  const signature = String(entry.signature || '').trim();
  state.modalTradeTape = [entry, ...state.modalTradeTape.filter((item) => !signature || item.signature !== signature)].slice(0, 50);
  renderModalTradeFeed();
  setModalTradeFeedStatus('Live updates stay active only while this modal remains open.');
}

function beginModalTradeFeed(mint) {
  unsubscribeModalTradeFeed();
  state.modalTradeTape = [];
  renderModalTradeFeed();
  subscribeModalTradeFeed(mint);
  startModalTradeFeedTimer();
  loadModalTradeFeed(mint);
}

function endModalTradeFeed() {
  unsubscribeModalTradeFeed();
  clearModalTradeFeedTimer();
  state.modalTradeTape = [];
  renderModalTradeFeed();
  setModalTradeFeedStatus('Open a token to load the last 50 live trades.');
}

function buildModalStats(item) {
  const blocks = [
    {
      label: 'MC',
      value: formatMarketCapUsd(item.marketCapUsd),
      tone: 'success'
    },
    {
      label: 'Curve',
      value: formatPercent(item.bondingCurveProgress),
      tone: 'violet'
    },
    {
      label: 'Volume',
      value: `${formatNumber(item.volumeSol ?? 0, 2)} SOL`,
      tone: 'warn'
    },
    {
      label: 'Buys',
      value: formatNumber(item.buyCount ?? 0, 0),
      tone: 'success'
    },
    {
      label: 'Sells',
      value: formatNumber(item.sellCount ?? 0, 0),
      tone: 'danger'
    },
    {
      label: 'Risk',
      value: normalizeRiskLabel(item),
      tone: normalizeRiskLabel(item) === 'High' ? 'danger' : normalizeRiskLabel(item) === 'Mid' ? 'warn' : 'success'
    }
  ];

  return blocks.map((block) => `
    <div class="modal-stat-card modal-stat-tone-${escapeHtml(block.tone)}">
      <span class="modal-stat-label">${escapeHtml(block.label)}</span>
      <strong>${escapeHtml(block.value)}</strong>
    </div>
  `).join('');
}

function getSelectedTokenItem() {
  if (!state.selectedMint) {
    return null;
  }

  return state.itemIndex.get(state.selectedMint) || state.selectedMintSnapshot;
}

function renderSelectedTokenModal() {
  const item = getSelectedTokenItem();
  if (!item) {
    return;
  }

  state.selectedMintSnapshot = item;
  const displayName = item.displayName || item.name || item.symbol || 'Token';
  const launchpad = item.displayLaunchpad || item.launchpad || item.pool || 'n/a';
  const riskLabel = normalizeRiskLabel(item);
  const curveLabel = formatPercent(item.bondingCurveProgress);

  elements.modalTitle.textContent = displayName;
  elements.modalSubtitle.textContent = `${launchpad} • ${item.symbol || shortenAddress(item.mint)} • ${state.activeDeskMode === 'local' ? 'Local' : 'Lightning'} desk`;
  elements.modalLaunchpadBadge.className = `modal-pill modal-pill-launchpad ${getModalLaunchpadToneClass(item.launchpad || item.pool || '')}`;
  elements.modalLaunchpadBadge.textContent = launchpad;
  elements.modalRiskBadge.className = `modal-pill ${riskLabel === 'High' ? 'modal-pill-danger' : riskLabel === 'Mid' ? 'modal-pill-warn' : 'modal-pill-good'}`;
  elements.modalRiskBadge.textContent = `Risk ${riskLabel}`;
  const curveValue = parseNumber(item.bondingCurveProgress);
  elements.modalCurveBadge.className = 'modal-pill modal-pill-violet';
  elements.modalCurveBadge.textContent = `Curve ${curveLabel}`;
  resetMintCopyState();
  elements.modalMint.textContent = item.mint;
  elements.modalLiveStamp.textContent = formatLiveAge(item.lastSeenAt);
  elements.modalMeta.innerHTML = buildModalStats(item);

  if (item.imageUrl) {
    if (elements.modalImage.getAttribute('src') !== item.imageUrl) {
      elements.modalImage.src = item.imageUrl;
    }
    elements.modalImage.hidden = false;
  } else {
    elements.modalImage.hidden = true;
    elements.modalImage.removeAttribute('src');
  }
}

function openModalForMint(mint) {
  const item = state.itemIndex.get(mint);
  if (!item) {
    return;
  }

  state.selectedMint = mint;
  state.selectedMintSnapshot = item;

  elements.tradeModal.classList.add('is-open');
  elements.tradeModal.setAttribute('aria-hidden', 'false');
  setTradeAction(getCurrentTradeAction());
  renderSelectedTokenModal();
  beginModalTradeFeed(mint);
  updateTradeModeHint();
}

function closeModal() {
  endModalTradeFeed();
  elements.tradeModal.classList.remove('is-open');
  elements.tradeModal.setAttribute('aria-hidden', 'true');
  resetMintCopyState();
  state.selectedMint = '';
  state.selectedMintSnapshot = null;
}

function updateTradeModeHint() {
  const isBuy = elements.tradeAction.value === 'buy';
  const amountMode = getCurrentTradeAmountMode();
  const modeLabel = state.activeDeskMode === 'local' ? 'Local Phantom' : 'Lightning';
  const amountPlaceholder = isBuy
    ? (amountMode === 'sol' ? '0.05' : '250000')
    : (amountMode === 'percent' ? '25%' : '250000');

  elements.tradeAmount.placeholder = amountPlaceholder;

  if (state.activeDeskMode === 'local') {
    elements.tradeJitoTip.hidden = true;
  }

  if (isBuy && amountMode === 'sol') {
    elements.tradeModeHint.textContent = `${modeLabel}: amount is treated as a SOL budget.`;
    return;
  }

  if (isBuy && amountMode === 'token') {
    elements.tradeModeHint.textContent = `${modeLabel}: amount is treated as token units.`;
    return;
  }

  if (!isBuy && amountMode === 'percent') {
    elements.tradeModeHint.textContent = `${modeLabel}: amount is treated as a sell percent.`;
    return;
  }

  elements.tradeModeHint.textContent = `${modeLabel}: amount is treated as token units for the sell side.`;
}

async function submitTrade() {
  const item = state.itemIndex.get(state.selectedMint);
  if (!item) {
    setStatus('Select a token card first.', 'bad');
    return;
  }

  const normalizedAmount = normalizeTradeAmountInput(elements.tradeAmount.value);
  if (normalizedAmount.error) {
    setStatus(normalizedAmount.error, 'bad');
    showToast('Amount error', normalizedAmount.error, 'error');
    return;
  }

  elements.tradeAmount.value = normalizedAmount.displayValue;

  const slippage = parseFlexiblePositiveNumber(elements.tradeSlippage.value);
  if (slippage === null) {
    setStatus('Slippage must be a positive number.', 'bad');
    showToast('Slippage error', 'Slippage must be a positive number.', 'error');
    return;
  }

  let priorityFeeSol;
  if (state.priorityMode === 'custom') {
    const parsedPriority = parseFlexiblePositiveNumber(elements.tradePriorityFee.value);
    if (parsedPriority === null) {
      setStatus('Custom priority fee must be a positive number.', 'bad');
      showToast('Priority fee error', 'Custom priority fee must be a positive number.', 'error');
      return;
    }
    priorityFeeSol = parsedPriority;
    elements.tradePriorityFee.value = formatTradeNumber(parsedPriority);
  }

  let jitoTip;
  if (state.activeDeskMode !== 'local' && state.jitoMode === 'custom') {
    const parsedJito = parseFlexiblePositiveNumber(elements.tradeJitoTip.value);
    if (parsedJito === null) {
      setStatus('Custom Jito tip must be a positive number.', 'bad');
      showToast('Jito tip error', 'Custom Jito tip must be a positive number.', 'error');
      return;
    }
    jitoTip = parsedJito;
    elements.tradeJitoTip.value = formatTradeNumber(parsedJito);
  }

  const payload = {
    action: elements.tradeAction.value,
    mint: item.mint,
    amount: state.activeDeskMode === 'local' && !normalizedAmount.value.endsWith('%')
      ? Number(normalizedAmount.value)
      : normalizedAmount.value,
    denominatedInSol: elements.tradeDenominatedInSol.value === 'true',
    slippage,
    pool: 'auto',
    priorityFeeSol,
    jitoTip: state.jitoMode === 'off' || state.activeDeskMode === 'local' ? undefined : jitoTip,
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
        showToast('Trade failed', `${item.symbol || 'Token'} ${payload.action} did not go through. ${message}`, 'error');
        return;
      }

      setStatus(`${payload.action === 'buy' ? 'Buy' : 'Sell'} sent through Lightning.`, 'ok');
      showToast(
        `${payload.action === 'buy' ? 'Buy' : 'Sell'} submitted`,
        `${item.symbol || 'Token'} ${payload.action} was accepted in Lightning mode. Amount ${normalizedAmount.displayValue}.`,
        'success',
        {
          detail: body.txSignature ? `Signature ${shortenAddress(body.txSignature)}` : '',
          linkHref: body.txSignature ? buildSolscanUrl(body.txSignature) : '',
          linkLabel: body.txSignature ? 'Open in Solscan' : ''
        }
      );
      closeModal();
      return;
    } catch (error) {
      setStatus(error.message, 'bad');
      showToast('Trade failed', `${item.symbol || 'Token'} ${payload.action} could not be sent. ${error.message}`, 'error');
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
      showToast('Local trade failed', `${item.symbol || 'Token'} ${payload.action} could not be prepared in Local mode. ${message}`, 'error');
      return;
    }

    if (!body.transaction) {
      throw new Error('Local trade did not return a transaction to sign.');
    }

    const transaction = window.solanaWeb3.VersionedTransaction.deserialize(base64ToBytes(body.transaction));
    const signed = await provider.signAndSendTransaction(transaction);
    setStatus(`${payload.action === 'buy' ? 'Buy' : 'Sell'} signed with Phantom.`, 'ok');
    showToast(
      `${payload.action === 'buy' ? 'Buy' : 'Sell'} submitted`,
      `${item.symbol || 'Token'} ${payload.action} was signed in Phantom and broadcast. Amount ${normalizedAmount.displayValue}.`,
      'success',
      {
        detail: signed.signature ? `Signature ${shortenAddress(signed.signature)}` : '',
        linkHref: signed.signature ? buildSolscanUrl(signed.signature) : '',
        linkLabel: signed.signature ? 'Open in Solscan' : ''
      }
    );
    closeModal();
  } catch (error) {
    setStatus(error.message, 'bad');
    showToast('Local trade failed', `${item.symbol || 'Token'} ${payload.action} could not be finished. ${error.message}`, 'error');
  }
}

async function loadRuntime() {
  const { body } = await requestJson('/api/runtime');
  state.runtime = body.runtime;
  state.capabilities = body.capabilities;
  setAvailableLaunchpads(body.runtime?.streamLaunchpads);
  setSocketState('offline');
  setStatus('Relay is preparing live launchpad data.', 'progress');
  loadDeskMode();
  loadQuickPresets();
  loadTradePanelConfig();
  loadLightningApiKey();
  loadColumnFilters();
  syncTradeHiddenFields();
  renderQuickButtons();
  renderActionSwitch();
  renderAmountModeSwitch();
  renderPresetRackEditor();
  renderColumnFilters('creates');
  renderColumnFilters('nearFill');
  renderColumnFilters('migrations');
  renderRelayControls();
  renderFeeControls();
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
if (elements.streamConnectButton) {
  elements.streamConnectButton.addEventListener('click', () => updateRelayConnection('/api/stream/connect', 'Requesting relay reconnect...', 'Relay reconnect requested.'));
}
if (elements.streamDisconnectButton) {
  elements.streamDisconnectButton.addEventListener('click', () => updateRelayConnection('/api/stream/disconnect', 'Pausing relay stream...', 'Relay stream paused.'));
}
elements.lightningApiKey.addEventListener('change', persistLightningApiKey);
elements.lightningApiKey.addEventListener('blur', persistLightningApiKey);
elements.lightningApiKey.addEventListener('input', persistLightningApiKey);
elements.togglePresetRackButton.addEventListener('click', togglePresetRackEditor);
elements.tradeActionBuyButton.addEventListener('click', () => setTradeAction('buy'));
elements.tradeActionSellButton.addEventListener('click', () => setTradeAction('sell'));
elements.tradeAmountModePrimaryButton.addEventListener('click', () => setTradeAmountMode(getCurrentTradeAction() === 'sell' ? 'percent' : 'sol'));
elements.tradeAmountModeSecondaryButton.addEventListener('click', () => setTradeAmountMode('token'));
elements.tradePriorityModeAutoButton.addEventListener('click', () => setPriorityMode('auto'));
elements.tradePriorityModeCustomButton.addEventListener('click', () => setPriorityMode('custom'));
elements.tradeJitoModeOffButton.addEventListener('click', () => setJitoMode('off'));
elements.tradeJitoModeAutoButton.addEventListener('click', () => setJitoMode('auto'));
elements.tradeJitoModeCustomButton.addEventListener('click', () => setJitoMode('custom'));
elements.submitTradeButton.addEventListener('click', submitTrade);
elements.closeModalButton.addEventListener('click', closeModal);
elements.copyMintButton.addEventListener('click', copySelectedMint);
elements.tradeAmount.addEventListener('blur', () => {
  const normalized = normalizeTradeAmountInput(elements.tradeAmount.value);
  if (!normalized.error) {
    elements.tradeAmount.value = normalized.displayValue;
  }
});
elements.tradeAmount.addEventListener('input', () => {
  state.tradePresetActiveSlot[getCurrentTradeAction()] = null;
  renderQuickButtons();
});
elements.tradeSlippage.addEventListener('blur', () => {
  const parsed = parseFlexiblePositiveNumber(elements.tradeSlippage.value);
  if (parsed !== null) {
    elements.tradeSlippage.value = formatTradeNumber(parsed);
  }
});
elements.tradePriorityFee.addEventListener('blur', () => {
  const parsed = parseFlexiblePositiveNumber(elements.tradePriorityFee.value);
  if (parsed !== null) {
    elements.tradePriorityFee.value = formatTradeNumber(parsed);
  }
});
elements.tradeJitoTip.addEventListener('blur', () => {
  const parsed = parseFlexiblePositiveNumber(elements.tradeJitoTip.value);
  if (parsed !== null) {
    elements.tradeJitoTip.value = formatTradeNumber(parsed);
  }
});
elements.tradeModal.addEventListener('click', (event) => {
  if (event.target === elements.tradeModal) {
    closeModal();
  }
});
setModalTradeFeedStatus('Open a token to load the last 50 live trades.');
renderModalTradeFeed();

document.addEventListener('keydown', (event) => {
  if (!elements.tradeModal.classList.contains('is-open')) {
    return;
  }

  const targetTag = event.target?.tagName;
  const isTypingTarget = ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag);

  if (event.key === 'Escape') {
    closeModal();
    return;
  }

  if (isTypingTarget) {
    return;
  }

  if (/^[1-6]$/.test(event.key)) {
    event.preventDefault();
    applyPreset(Number(event.key) - 1);
    return;
  }

  if (event.key.toLowerCase() === 'b') {
    event.preventDefault();
    setTradeAction('buy');
    return;
  }

  if (event.key.toLowerCase() === 's') {
    event.preventDefault();
    setTradeAction('sell');
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    submitTrade();
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
    if (state.presetEditorOpen || event.target.closest('.quick-chip-input')) {
      return;
    }
    applyPreset(Number(presetButton.dataset.presetSlot));
  }
});

elements.quickButtons.addEventListener('input', (event) => {
  if (event.target instanceof HTMLInputElement) {
    updatePresetFromEditor(event.target);
  }
});

elements.quickButtons.addEventListener('blur', (event) => {
  if (event.target instanceof HTMLInputElement) {
    if (state.presetEditorOpen) {
      persistQuickPresets();
      return;
    }
    saveQuickPresets();
  }
}, true);

elements.quickButtons.addEventListener('pointerdown', (event) => {
  if (!state.presetEditorOpen) {
    return;
  }

  const chip = event.target.closest('.quick-chip');
  if (!chip) {
    return;
  }

  const input = chip.querySelector('.quick-chip-input');
  if (!input || event.target === input) {
    return;
  }

  event.preventDefault();
  input.focus();
  const caret = input.value.length;
  input.setSelectionRange(caret, caret);
});

elements.quickButtons.addEventListener('click', (event) => {
  if (!state.presetEditorOpen) {
    return;
  }

  const chip = event.target.closest('.quick-chip');
  if (!chip) {
    return;
  }

  const input = chip.querySelector('.quick-chip-input');
  if (!input) {
    return;
  }

  if (event.target !== input) {
    input.focus();
    const caret = input.value.length;
    input.setSelectionRange(caret, caret);
  }

  event.stopPropagation();
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