const state = {
  runtime: null,
  rows: [],
  sortBy: 'feePartnerSol',
  sortDirection: 'desc'
};

const elements = {
  title: document.getElementById('title'),
  subtitle: document.getElementById('subtitle'),
  ownerHint: document.getElementById('ownerHint'),
  form: document.getElementById('analyticsForm'),
  output: document.getElementById('output'),
  status: document.getElementById('statusBox'),
  configState: document.getElementById('configState'),
  summaryGrid: document.getElementById('summaryGrid'),
  windowNote: document.getElementById('windowNote'),
  tableBody: document.getElementById('tableBody'),
  signature: document.getElementById('signature')
};

function setStatus(message, tone = 'neutral') {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function setOutput(payload) {
  elements.output.textContent = JSON.stringify(payload, null, 2);
}

function buildPayload() {
  const payload = {
    frame: document.getElementById('frame').value.trim(),
    partnerAddress: document.getElementById('partnerAddress').value.trim(),
    projectId: document.getElementById('projectId').value.trim(),
    userWallet: document.getElementById('userWallet').value.trim()
  };

  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value));
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

function renderSummary(summary) {
  const metrics = [
    ['Frame', summary.frame],
    ['Current timestamp ms', String(summary.currentTimestampMs)],
    ['Total volume SOL', String(summary.totalVolumeSol)],
    ['API fee SOL', String(summary.totalFeeApiSol)],
    ['Partner fee SOL', String(summary.totalFeePartnerSol)],
    ['Buys / Sells', `${summary.totalBuyCount} / ${summary.totalSellCount}`],
    ['Rows', String(summary.rowsCount)]
  ];

  elements.summaryGrid.innerHTML = metrics.map(([label, value]) => `
    <article class="metric-card">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value}</div>
    </article>
  `).join('');

  elements.windowNote.textContent = `Window ${summary.fromTimestampMs} → ${summary.toTimestampMs}. partner=${summary.partnerAddress ?? 'any'} project=${summary.projectId ?? 'any'} wallet=${summary.userWallet ?? 'any'}.`;
  elements.signature.textContent = `Loaded ${summary.rowsCount} row(s)`;
}

function renderRows() {
  if (!state.rows.length) {
    elements.tableBody.innerHTML = '<tr><td colspan="6">No matching rows.</td></tr>';
    return;
  }

  const directionFactor = state.sortDirection === 'asc' ? 1 : -1;
  const rows = [...state.rows].sort((left, right) => {
    const leftValue = left[state.sortBy];
    const rightValue = right[state.sortBy];

    if (typeof leftValue === 'string') {
      return leftValue.localeCompare(rightValue) * directionFactor;
    }

    return (Number(leftValue) - Number(rightValue)) * directionFactor;
  });

  elements.tableBody.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.userWallet}</td>
      <td>${row.volumeSol}</td>
      <td>${row.feeApiSol}</td>
      <td>${row.feePartnerSol}</td>
      <td>${row.buyCount}</td>
      <td>${row.sellCount}</td>
    </tr>
  `).join('');
}

async function loadRuntime() {
  const { body } = await requestJson('/api/runtime');
  state.runtime = body.runtime;
  elements.title.textContent = state.runtime.title;
  elements.subtitle.textContent = `Local relay on port ${state.runtime.port}. The public API key stays server-side and must resolve to the same partner wallet used for analytics.`;
  elements.configState.textContent = state.runtime.canQueryAnalytics ? 'API key verified' : (state.runtime.hasApiKey ? 'API key check failed' : 'Missing API key');
  elements.configState.dataset.tone = state.runtime.canQueryAnalytics ? 'ok' : 'bad';

  const partnerInput = document.getElementById('partnerAddress');
  partnerInput.value = state.runtime.ownerPublicKey || '';

  if (state.runtime.ownerPublicKey) {
    elements.ownerHint.textContent = `Partner wallet resolved from API key: ${state.runtime.ownerPublicKey}${state.runtime.apiKeyVersion ? ` (version ${state.runtime.apiKeyVersion})` : ''}.`;
    setStatus('Ready to query developer analytics.', 'ok');
  } else if (state.runtime.hasApiKey) {
    elements.ownerHint.textContent = `Configured API key could not be verified: ${state.runtime.verifyError || 'unknown error'}`;
    setStatus('Configured API key is invalid for analytics access.', 'bad');
  } else {
    elements.ownerHint.textContent = 'Set CORTO_API_KEY in .env so the relay can resolve the partner wallet.';
    setStatus('Set CORTO_API_KEY in .env before querying analytics.', 'bad');
  }
}

async function submitAnalytics(event) {
  event.preventDefault();
  const payload = buildPayload();

  setStatus('Querying local relay...', 'progress');
  setOutput({ querying: payload });

  try {
    const { response, body } = await requestJson('/api/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    setOutput(body);

    if (!response.ok || body?.success === false) {
      state.rows = [];
      renderRows();
      setStatus(body?.error?.message || `HTTP ${response.status}`, 'bad');
      return;
    }

    state.rows = Array.isArray(body.rows) ? body.rows : [];
    renderSummary(body.summary);
    renderRows();
    setStatus(`Analytics loaded for ${body.summary.frame}.`, 'ok');
  } catch (error) {
    state.rows = [];
    renderRows();
    setOutput({ success: false, error: { message: error.message } });
    setStatus(error.message, 'bad');
  }
}

function bindSortButtons() {
  document.querySelectorAll('[data-sort]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextSortBy = button.dataset.sort;
      if (state.sortBy === nextSortBy) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortBy = nextSortBy;
        state.sortDirection = nextSortBy === 'userWallet' ? 'asc' : 'desc';
      }

      renderRows();
    });
  });
}

elements.form.addEventListener('submit', submitAnalytics);
bindSortButtons();

loadRuntime().catch((error) => {
  setOutput({ success: false, error: { message: error.message } });
  setStatus(error.message, 'bad');
});