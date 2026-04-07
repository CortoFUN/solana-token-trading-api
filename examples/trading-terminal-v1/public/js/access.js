const LIGHTNING_API_KEY_STORAGE = 'corto-fluxboard-lightning-api-key-v20260402';
const ACCESS_MODE_STORAGE_KEY = 'corto-access-mode-v20260405';
const ACCESS_AGENT_SETTINGS_KEY_STORAGE = 'corto-access-agent-settings-key-v20260405';

const accessElements = {
  toastStack: document.getElementById('toastStack'),
  accessHeaderApiKey: document.getElementById('accessHeaderApiKey'),
  accessHeaderApiKeyVisibilityButton: document.getElementById('accessHeaderApiKeyVisibilityButton'),
  accessModeWalletButton: document.getElementById('accessModeWalletButton'),
  accessModeAgentButton: document.getElementById('accessModeAgentButton'),
  walletSurface: document.getElementById('walletSurface'),
  agentSurface: document.getElementById('agentSurface'),
  generateWalletButton: document.getElementById('generateWalletButton'),
  walletGenerateStatus: document.getElementById('walletGenerateStatus'),
  walletGenerateTools: document.getElementById('walletGenerateTools'),
  walletGenerateResult: document.getElementById('walletGenerateResult'),
  verifyWalletButton: document.getElementById('verifyWalletButton'),
  walletVerifyStatus: document.getElementById('walletVerifyStatus'),
  walletVerifyResult: document.getElementById('walletVerifyResult'),
  generateAgentButton: document.getElementById('generateAgentButton'),
  agentGenerateStatus: document.getElementById('agentGenerateStatus'),
  agentGenerateTools: document.getElementById('agentGenerateTools'),
  agentGenerateResult: document.getElementById('agentGenerateResult'),
  agentSettingsKeyInput: document.getElementById('agentSettingsKeyInput'),
  agentSettingsKeyVisibilityButton: document.getElementById('agentSettingsKeyVisibilityButton'),
  loadAgentButton: document.getElementById('loadAgentButton'),
  saveAgentSettingsButton: document.getElementById('saveAgentSettingsButton'),
  agentLoadStatus: document.getElementById('agentLoadStatus'),
  agentSummaryPublicKey: document.getElementById('agentSummaryPublicKey'),
  agentSummarySol: document.getElementById('agentSummarySol'),
  agentSummarySuccess: document.getElementById('agentSummarySuccess'),
  agentSummaryLastAction: document.getElementById('agentSummaryLastAction'),
  agentHistoryList: document.getElementById('agentHistoryList'),
  capLightningTrade: document.getElementById('capLightningTrade'),
  capSwap: document.getElementById('capSwap'),
  capTransfer: document.getElementById('capTransfer'),
  capTokenCreate: document.getElementById('capTokenCreate'),
  capTokenClaim: document.getElementById('capTokenClaim'),
  limitPerTxSol: document.getElementById('limitPerTxSol'),
  limitRollingWindowSol: document.getElementById('limitRollingWindowSol')
};

const accessState = {
  mode: 'wallet',
  agentCapabilities: null,
  agentProfile: null,
  agentBalances: null,
  agentStats: null,
  agentHistory: [],
  walletBundle: null,
  agentBundle: null
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showToast(title, message, tone = 'success') {
  const toast = document.createElement('article');
  toast.className = `toast toast-${tone}`;
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  accessElements.toastStack.prepend(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 4200);
}

function setInlineStatus(node, message, tone = 'idle') {
  if (!node) {
    return;
  }

  node.textContent = message;
  node.dataset.tone = tone;
}

function persistHeaderApiKey() {
  localStorage.setItem(LIGHTNING_API_KEY_STORAGE, accessElements.accessHeaderApiKey.value.trim());
}

function loadHeaderApiKey() {
  accessElements.accessHeaderApiKey.value = localStorage.getItem(LIGHTNING_API_KEY_STORAGE) || '';
}

function persistMode() {
  localStorage.setItem(ACCESS_MODE_STORAGE_KEY, accessState.mode);
}

function loadMode() {
  accessState.mode = localStorage.getItem(ACCESS_MODE_STORAGE_KEY) === 'agent' ? 'agent' : 'wallet';
}

function persistSettingsKey() {
  localStorage.setItem(ACCESS_AGENT_SETTINGS_KEY_STORAGE, accessElements.agentSettingsKeyInput.value.trim());
}

function loadSettingsKey() {
  accessElements.agentSettingsKeyInput.value = localStorage.getItem(ACCESS_AGENT_SETTINGS_KEY_STORAGE) || '';
}

function formatNumber(value, digits = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '—';
  }

  return parsed.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatRelativeTime(value) {
  const timestamp = Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp)) {
    return '—';
  }

  const diffSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function shortenValue(value, head = 6, tail = 4) {
  const text = String(value || '').trim();
  if (!text) {
    return '—';
  }

  if (text.length <= head + tail + 3) {
    return text;
  }

  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

function normalizeField(label, value, options = {}) {
  const normalizedValue = value === undefined || value === null || value === '' ? '—' : String(value);
  return {
    label,
    value: normalizedValue,
    displayValue: options.displayValue || normalizedValue,
    copyValue: options.copyValue || (normalizedValue === '—' ? '' : normalizedValue),
    isSecret: Boolean(options.isSecret),
    hint: options.hint || ''
  };
}

function buildWalletBundle(body) {
  return {
    kind: 'wallet',
    title: 'Personal wallet bundle',
    filePrefix: 'user_wallet',
    warning: 'Keys are shown one time during generation. Lost private keys and API keys cannot be restored.',
    publicKey: body?.publicKey || '',
    fields: [
      normalizeField('Public key', body?.publicKey, { copyValue: body?.publicKey || '' }),
      normalizeField('Private key', body?.privateKey, { copyValue: body?.privateKey || '', isSecret: true, hint: 'Store this now. Recovery is impossible.' }),
      normalizeField('API key', body?.apiKey, { copyValue: body?.apiKey || '', isSecret: true, hint: 'Shown once. Save before leaving this page.' }),
      normalizeField('Key version', body?.apiKeyVersion)
    ]
  };
}

function buildAgentBundle(body) {
  const executionKey = body?.executionKey || body?.executionApiKey || '';
  return {
    kind: 'agent',
    title: 'Agent wallet bundle',
    filePrefix: 'agent_wallet',
    warning: 'Keys are shown one time during generation. Lost private, execution, or settings keys cannot be restored.',
    publicKey: body?.publicKey || '',
    fields: [
      normalizeField('Public key', body?.publicKey, { copyValue: body?.publicKey || '' }),
      normalizeField('Private key', body?.privateKey, { copyValue: body?.privateKey || '', isSecret: true, hint: 'Store this now. Recovery is impossible.' }),
      normalizeField('Execution key', executionKey, { copyValue: executionKey || '', isSecret: true, hint: 'Used for automated execution requests.' }),
      normalizeField('Settings key', body?.settingsKey, { copyValue: body?.settingsKey || '', isSecret: true, hint: 'Needed later to open and tune the agent wallet.' }),
      normalizeField('Execution version', body?.executionKeyVersion),
      normalizeField('Settings version', body?.settingsKeyVersion)
    ]
  };
}

function getBundleToolsNode(kind) {
  return kind === 'agent' ? accessElements.agentGenerateTools : accessElements.walletGenerateTools;
}

function getBundleState(kind) {
  return kind === 'agent' ? accessState.agentBundle : accessState.walletBundle;
}

function setBundleState(kind, bundle) {
  if (kind === 'agent') {
    accessState.agentBundle = bundle;
  } else {
    accessState.walletBundle = bundle;
  }

  const toolsNode = getBundleToolsNode(kind);
  if (toolsNode) {
    toolsNode.hidden = !bundle;
  }
}

function buildBundleClipboardText(bundle) {
  if (!bundle) {
    return '';
  }

  const lines = [bundle.title, bundle.warning, ''];
  bundle.fields.forEach((field) => {
    lines.push(`${field.label}: ${field.value}`);
  });
  return lines.join('\n');
}

function sanitizeFileNameSegment(value, fallback = 'unknown') {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

function buildBundleMarkdown(bundle) {
  if (!bundle) {
    return '';
  }

  const lines = [
    `# ${bundle.title}`,
    '',
    '> Important: This bundle is shown one time during generation. If any secret is lost later, it cannot be restored.',
    '',
    `Generated at: ${new Date().toISOString()}`,
    ''
  ];

  bundle.fields.forEach((field) => {
    lines.push(`- ${field.label}: ${field.value}`);
  });

  return lines.join('\n');
}

function buildBundleFileName(bundle) {
  if (!bundle) {
    return 'wallet_bundle.md';
  }

  return `${bundle.filePrefix}_${sanitizeFileNameSegment(bundle.publicKey, 'unknown_public_key')}.md`;
}

function downloadTextFile(fileName, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function setSecretInputVisibility(button, input, forceVisible) {
  if (!button || !input) {
    return;
  }

  const shouldShow = typeof forceVisible === 'boolean' ? forceVisible : input.type === 'password';
  input.type = shouldShow ? 'text' : 'password';
  button.classList.toggle('is-active', shouldShow);
  button.setAttribute('aria-label', shouldShow ? button.dataset.hideLabel : button.dataset.showLabel);
  button.title = shouldShow ? button.dataset.hideLabel : button.dataset.showLabel;
  const label = button.querySelector('span');
  if (label) {
    label.textContent = shouldShow ? 'Hide' : 'Show';
  }
}

function renderResultGrid(node, fields, emptyText) {
  if (!node) {
    return;
  }

  if (!Array.isArray(fields) || !fields.length) {
    node.className = 'access-result-grid access-result-empty';
    node.innerHTML = `<div class="result-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }

  node.className = 'access-result-grid';
  node.innerHTML = fields.map((field) => {
    const copyButton = field.copyValue
      ? `<button class="button-ghost access-copy-button" type="button" data-copy-value="${escapeHtml(field.copyValue)}">Copy</button>`
      : '';
    const hint = field.hint
      ? `<em class="access-result-hint">${escapeHtml(field.hint)}</em>`
      : '';
    const valueClassName = field.isSecret ? 'access-result-value is-secret' : 'access-result-value';

    return `
      <div class="access-result-card">
        <span>${escapeHtml(field.label)}</span>
        <strong class="${valueClassName}" title="${escapeHtml(field.value)}">${escapeHtml(field.displayValue || field.value)}</strong>
        ${hint}
        ${copyButton}
      </div>
    `;
  }).join('');
}

function renderWalletGenerate(body) {
  const bundle = buildWalletBundle(body);
  setBundleState('wallet', bundle);
  renderResultGrid(accessElements.walletGenerateResult, bundle.fields, 'No wallet bundle generated yet.');
}

function renderWalletVerify(body) {
  renderResultGrid(accessElements.walletVerifyResult, [
    { label: 'Wallet type', value: body?.walletType || 'wallet' },
    { label: 'Public key', value: body?.publicKey || '—', displayValue: shortenValue(body?.publicKey), copyValue: body?.publicKey || '' },
    { label: 'Key version', value: String(body?.apiKeyVersion ?? '—') }
  ], 'Verification output will appear here.');
}

function renderAgentGenerate(body) {
  const bundle = buildAgentBundle(body);
  setBundleState('agent', bundle);
  renderResultGrid(accessElements.agentGenerateResult, bundle.fields, 'No agent wallet bundle generated yet.');
}

function renderAgentSummary() {
  const profile = accessState.agentProfile?.profile || {};
  const balances = accessState.agentBalances?.balances || {};
  const stats = accessState.agentStats?.stats || {};
  const history = Array.isArray(accessState.agentHistory) ? accessState.agentHistory : [];
  const totalCount = Number(stats.totalCount || 0);
  const successCount = Number(stats.successCount || 0);
  const successRate = totalCount > 0 ? `${Math.round((successCount / totalCount) * 100)}%` : '—';

  accessElements.agentSummaryPublicKey.textContent = shortenValue(profile.publicKey);
  accessElements.agentSummarySol.textContent = balances.solBalance !== undefined && balances.solBalance !== null
    ? `${formatNumber(balances.solBalance, 4)} SOL`
    : '—';
  accessElements.agentSummarySuccess.textContent = successRate;
  accessElements.agentSummaryLastAction.textContent = history.length
    ? formatRelativeTime(history[0]?.createdAt || history[0]?.updatedAt || history[0]?.timestamp)
    : '—';
}

function renderAgentSettingsFromProfile() {
  const policy = accessState.agentProfile?.profile?.policy || {};
  const capabilities = policy.capabilities || {};
  const limits = policy.limits || {};

  accessElements.capLightningTrade.checked = Boolean(capabilities.lightningTrade);
  accessElements.capSwap.checked = Boolean(capabilities.swap);
  accessElements.capTransfer.checked = Boolean(capabilities.transfer);
  accessElements.capTokenCreate.checked = Boolean(capabilities.tokenCreate);
  accessElements.capTokenClaim.checked = Boolean(capabilities.tokenClaim);
  accessElements.limitPerTxSol.value = limits.perTxSol ?? '';
  accessElements.limitRollingWindowSol.value = limits.rollingWindowSol ?? '';
}

function renderAgentHistory() {
  const history = Array.isArray(accessState.agentHistory) ? accessState.agentHistory : [];

  if (!history.length) {
    accessElements.agentHistoryList.innerHTML = '<div class="result-empty">Recent agent operations will appear here.</div>';
    return;
  }

  accessElements.agentHistoryList.innerHTML = history.map((item) => {
    const title = item?.action || item?.type || item?.operation || item?.category || 'Operation';
    const status = item?.status || item?.state || (item?.success === false ? 'failed' : item?.success === true ? 'success' : 'recorded');
    const secondary = item?.mint || item?.signature || item?.txSignature || item?.message || item?.reason || item?.code || 'No extra details';
    const stamp = item?.createdAt || item?.updatedAt || item?.timestamp;

    return `
      <article class="access-history-item">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(String(secondary))}</span>
        </div>
        <div class="access-history-meta">
          <span>${escapeHtml(status)}</span>
          <span>${escapeHtml(formatRelativeTime(stamp))}</span>
        </div>
      </article>
    `;
  }).join('');
}

function setMode(mode) {
  accessState.mode = mode === 'agent' ? 'agent' : 'wallet';
  accessElements.accessModeWalletButton.classList.toggle('is-active', accessState.mode === 'wallet');
  accessElements.accessModeAgentButton.classList.toggle('is-active', accessState.mode === 'agent');
  accessElements.walletSurface.hidden = accessState.mode !== 'wallet';
  accessElements.agentSurface.hidden = accessState.mode !== 'agent';
  accessElements.walletSurface.classList.toggle('is-active', accessState.mode === 'wallet');
  accessElements.agentSurface.classList.toggle('is-active', accessState.mode === 'agent');
  persistMode();
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

async function copyValue(value) {
  if (!value) {
    return;
  }

  await navigator.clipboard.writeText(value);
}

async function generateWallet() {
  accessElements.generateWalletButton.disabled = true;
  setInlineStatus(accessElements.walletGenerateStatus, 'Generating a fresh wallet bundle...', 'progress');

  try {
    const { response, body } = await requestJson('/api/wallet/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });

    if (!response.ok || body?.success === false) {
      const message = body?.error?.message || `HTTP ${response.status}`;
      setInlineStatus(accessElements.walletGenerateStatus, message, 'error');
      showToast('Wallet generation failed', message, 'error');
      return;
    }

    renderWalletGenerate(body);
    accessElements.accessHeaderApiKey.value = body?.apiKey || accessElements.accessHeaderApiKey.value;
    persistHeaderApiKey();
    setSecretInputVisibility(accessElements.accessHeaderApiKeyVisibilityButton, accessElements.accessHeaderApiKey, false);
    setInlineStatus(accessElements.walletGenerateStatus, 'Wallet bundle generated. Copy or save the keys now because they cannot be restored later.', 'success');
    showToast('Wallet ready', 'Keys were generated once. Copy them now or save the markdown file before leaving this page.');
  } catch (error) {
    setInlineStatus(accessElements.walletGenerateStatus, error.message, 'error');
    showToast('Wallet generation failed', error.message, 'error');
  } finally {
    accessElements.generateWalletButton.disabled = false;
  }
}

async function verifyWalletKey() {
  const apiKey = accessElements.accessHeaderApiKey.value.trim();

  if (!apiKey) {
    const message = 'Paste a wallet API key in the header first.';
    setInlineStatus(accessElements.walletVerifyStatus, message, 'error');
    showToast('API key required', message, 'error');
    return;
  }

  accessElements.verifyWalletButton.disabled = true;
  setInlineStatus(accessElements.walletVerifyStatus, 'Verifying the current key against Corto runtime...', 'progress');

  try {
    const { response, body } = await requestJson('/api/verify', {
      method: 'POST',
      headers: { 'x-api-key': apiKey }
    });

    if (!response.ok || body?.success === false) {
      const message = body?.error?.message || `HTTP ${response.status}`;
      setInlineStatus(accessElements.walletVerifyStatus, message, 'error');
      showToast('Verify failed', message, 'error');
      return;
    }

    renderWalletVerify(body);
    setInlineStatus(accessElements.walletVerifyStatus, 'Key is valid and mapped to the wallet shown below.', 'success');
    showToast('Key verified', `This key resolves to ${shortenValue(body?.publicKey)}.`);
  } catch (error) {
    setInlineStatus(accessElements.walletVerifyStatus, error.message, 'error');
    showToast('Verify failed', error.message, 'error');
  } finally {
    accessElements.verifyWalletButton.disabled = false;
  }
}

async function generateAgentWallet() {
  accessElements.generateAgentButton.disabled = true;
  setInlineStatus(accessElements.agentGenerateStatus, 'Generating a new agent wallet bundle...', 'progress');

  try {
    const { response, body } = await requestJson('/api/agent-wallet/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });

    if (!response.ok || body?.success === false) {
      const message = body?.error?.message || `HTTP ${response.status}`;
      setInlineStatus(accessElements.agentGenerateStatus, message, 'error');
      showToast('Agent generation failed', message, 'error');
      return;
    }

    renderAgentGenerate(body);
    accessElements.agentSettingsKeyInput.value = body?.settingsKey || accessElements.agentSettingsKeyInput.value;
    persistSettingsKey();
    setSecretInputVisibility(accessElements.agentSettingsKeyVisibilityButton, accessElements.agentSettingsKeyInput, false);
    setInlineStatus(accessElements.agentGenerateStatus, 'Agent wallet generated. Copy or save the keys now because they cannot be restored later.', 'success');
    showToast('Agent wallet ready', 'Execution and settings keys were generated once. Copy them now or save the markdown file.');
  } catch (error) {
    setInlineStatus(accessElements.agentGenerateStatus, error.message, 'error');
    showToast('Agent generation failed', error.message, 'error');
  } finally {
    accessElements.generateAgentButton.disabled = false;
  }
}

async function loadAgentSurface() {
  const settingsKey = accessElements.agentSettingsKeyInput.value.trim();

  if (!settingsKey) {
    const message = 'Paste a settings key before loading agent data.';
    setInlineStatus(accessElements.agentLoadStatus, message, 'error');
    showToast('Settings key required', message, 'error');
    return;
  }

  accessElements.loadAgentButton.disabled = true;
  setInlineStatus(accessElements.agentLoadStatus, 'Loading agent profile, balances, stats, and history...', 'progress');
  persistSettingsKey();

  try {
    const headers = { 'x-settings-key': settingsKey };
    const [profileResult, balancesResult, statsResult, historyResult] = await Promise.all([
      requestJson('/api/agent-wallet/profile', { headers }),
      requestJson('/api/agent-wallet/balances', { headers }),
      requestJson('/api/agent-wallet/stats', { headers }),
      requestJson('/api/agent-wallet/history?limit=8', { headers })
    ]);

    const failedResult = [profileResult, balancesResult, statsResult, historyResult].find((item) => !item.response.ok || item.body?.success === false);
    if (failedResult) {
      const message = failedResult.body?.error?.message || `HTTP ${failedResult.response.status}`;
      setInlineStatus(accessElements.agentLoadStatus, message, 'error');
      showToast('Agent load failed', message, 'error');
      return;
    }

    accessState.agentProfile = profileResult.body;
    accessState.agentBalances = balancesResult.body;
    accessState.agentStats = statsResult.body;
    accessState.agentHistory = Array.isArray(historyResult.body?.history) ? historyResult.body.history : [];
    renderAgentSettingsFromProfile();
    renderAgentSummary();
    renderAgentHistory();
    setInlineStatus(accessElements.agentLoadStatus, 'Agent policy and runtime details loaded.', 'success');
    showToast('Agent loaded', `Policy for ${shortenValue(accessState.agentProfile?.profile?.publicKey)} is ready.`);
  } catch (error) {
    setInlineStatus(accessElements.agentLoadStatus, error.message, 'error');
    showToast('Agent load failed', error.message, 'error');
  } finally {
    accessElements.loadAgentButton.disabled = false;
  }
}

function buildSettingsPayload() {
  const payload = {
    capabilities: {
      lightningTrade: accessElements.capLightningTrade.checked,
      swap: accessElements.capSwap.checked,
      transfer: accessElements.capTransfer.checked,
      tokenCreate: accessElements.capTokenCreate.checked,
      tokenClaim: accessElements.capTokenClaim.checked
    },
    limits: {}
  };

  const perTxSol = accessElements.limitPerTxSol.value.trim();
  const rollingWindowSol = accessElements.limitRollingWindowSol.value.trim();

  if (perTxSol) {
    payload.limits.perTxSol = Number(perTxSol);
  }

  if (rollingWindowSol) {
    payload.limits.rollingWindowSol = Number(rollingWindowSol);
  }

  return payload;
}

async function saveAgentSettings() {
  const settingsKey = accessElements.agentSettingsKeyInput.value.trim();

  if (!settingsKey) {
    const message = 'Paste a settings key before saving policy changes.';
    setInlineStatus(accessElements.agentLoadStatus, message, 'error');
    showToast('Settings key required', message, 'error');
    return;
  }

  accessElements.saveAgentSettingsButton.disabled = true;
  setInlineStatus(accessElements.agentLoadStatus, 'Saving agent policy...', 'progress');

  try {
    const { response, body } = await requestJson('/api/agent-wallet/settings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-settings-key': settingsKey
      },
      body: JSON.stringify(buildSettingsPayload())
    });

    if (!response.ok || body?.success === false) {
      const message = body?.error?.message || `HTTP ${response.status}`;
      setInlineStatus(accessElements.agentLoadStatus, message, 'error');
      showToast('Policy save failed', message, 'error');
      return;
    }

    accessState.agentProfile = body;
    renderAgentSettingsFromProfile();
    renderAgentSummary();
    setInlineStatus(accessElements.agentLoadStatus, 'Agent policy saved. Partial patch was applied successfully.', 'success');
    showToast('Policy updated', 'Capabilities and limits were saved for this agent wallet.');
  } catch (error) {
    setInlineStatus(accessElements.agentLoadStatus, error.message, 'error');
    showToast('Policy save failed', error.message, 'error');
  } finally {
    accessElements.saveAgentSettingsButton.disabled = false;
  }
}

async function loadCapabilities() {
  try {
    const { response, body } = await requestJson('/api/agent-wallet/capabilities');
    if (response.ok && body?.success !== false) {
      accessState.agentCapabilities = body;
    }
  } catch {
    return;
  }
}

accessElements.accessModeWalletButton.addEventListener('click', () => setMode('wallet'));
accessElements.accessModeAgentButton.addEventListener('click', () => setMode('agent'));
accessElements.accessHeaderApiKey.addEventListener('change', persistHeaderApiKey);
accessElements.accessHeaderApiKey.addEventListener('blur', persistHeaderApiKey);
accessElements.accessHeaderApiKey.addEventListener('input', persistHeaderApiKey);
accessElements.agentSettingsKeyInput.addEventListener('change', persistSettingsKey);
accessElements.agentSettingsKeyInput.addEventListener('blur', persistSettingsKey);
accessElements.agentSettingsKeyInput.addEventListener('input', persistSettingsKey);
accessElements.generateWalletButton.addEventListener('click', generateWallet);
accessElements.verifyWalletButton.addEventListener('click', verifyWalletKey);
accessElements.generateAgentButton.addEventListener('click', generateAgentWallet);
accessElements.loadAgentButton.addEventListener('click', loadAgentSurface);
accessElements.saveAgentSettingsButton.addEventListener('click', saveAgentSettings);

document.addEventListener('click', async (event) => {
  const visibilityButton = event.target.closest('[data-target-input]');
  if (visibilityButton) {
    const input = document.getElementById(visibilityButton.dataset.targetInput || '');
    setSecretInputVisibility(visibilityButton, input);
    return;
  }

  const bundleActionButton = event.target.closest('[data-bundle-action][data-bundle-kind]');
  if (bundleActionButton) {
    const bundle = getBundleState(bundleActionButton.dataset.bundleKind || '');
    if (!bundle) {
      showToast('Nothing to export', 'Generate a bundle first so there is something to copy or save.', 'error');
      return;
    }

    try {
      if (bundleActionButton.dataset.bundleAction === 'copy-all') {
        await copyValue(buildBundleClipboardText(bundle));
        showToast('Bundle copied', 'The full key bundle is now in your clipboard.');
        return;
      }

      if (bundleActionButton.dataset.bundleAction === 'download') {
        downloadTextFile(buildBundleFileName(bundle), buildBundleMarkdown(bundle));
        showToast('Markdown saved', `Downloaded ${buildBundleFileName(bundle)} to your PC.`);
        return;
      }
    } catch (error) {
      showToast('Bundle action failed', error.message || 'The requested bundle action failed.', 'error');
      return;
    }
  }

  const button = event.target.closest('[data-copy-value]');
  if (!button) {
    return;
  }

  try {
    await copyValue(button.dataset.copyValue || '');
    showToast('Copied', 'Value copied to clipboard.');
  } catch (error) {
    showToast('Copy failed', error.message || 'Clipboard is unavailable.', 'error');
  }
});

async function init() {
  loadHeaderApiKey();
  loadMode();
  loadSettingsKey();
  setMode(accessState.mode);
  setSecretInputVisibility(accessElements.accessHeaderApiKeyVisibilityButton, accessElements.accessHeaderApiKey, false);
  setSecretInputVisibility(accessElements.agentSettingsKeyVisibilityButton, accessElements.agentSettingsKeyInput, false);
  await loadCapabilities();
}

init().catch((error) => {
  showToast('Access desk error', error.message, 'error');
});