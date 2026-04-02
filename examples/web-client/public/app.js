const state = {
  runtime: null,
  lastTradeSignature: '',
  lastTradePayload: null
};

const elements = {
  title: document.getElementById('title'),
  subtitle: document.getElementById('subtitle'),
  form: document.getElementById('tradeForm'),
  action: document.getElementById('action'),
  denominatedInSol: document.getElementById('denominatedInSol'),
  amountModeHint: document.getElementById('amountModeHint'),
  pool: document.getElementById('pool'),
  output: document.getElementById('output'),
  status: document.getElementById('statusBox'),
  configState: document.getElementById('configState'),
  signature: document.getElementById('signature'),
  refreshStatusButton: document.getElementById('refreshStatusButton')
};

function setStatus(message, tone = 'neutral') {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function setOutput(payload) {
  elements.output.textContent = JSON.stringify(payload, null, 2);
}

function buildPayload() {
  const currentAction = elements.action.value;
  return {
    action: currentAction,
    mint: document.getElementById('mint').value.trim(),
    amount: document.getElementById('amount').value.trim(),
    denominatedInSol: elements.denominatedInSol.value === 'true',
    slippage: Number(document.getElementById('slippage').value || 5),
    pool: elements.pool.value,
    priorityFeeSol: document.getElementById('priorityFeeSol').value ? Number(document.getElementById('priorityFeeSol').value) : undefined,
    jitoTip: document.getElementById('jitoTip').value ? Number(document.getElementById('jitoTip').value) : undefined,
    memo: document.getElementById('memo').value.trim() || undefined
  };
}

function updateAmountModeHint() {
  const isBuy = elements.action.value === 'buy';
  const isSolMode = elements.denominatedInSol.value === 'true';

  if (isBuy && isSolMode) {
    elements.amountModeHint.textContent = 'Buy mode: amount is treated as a SOL budget. Example: 0.1 spends about 0.1 SOL through Lightning.';
    return;
  }

  if (isBuy) {
    elements.amountModeHint.textContent = 'Buy mode: amount is treated as token units. Use this when you need an exact token amount instead of a SOL budget.';
    return;
  }

  if (isSolMode) {
    elements.amountModeHint.textContent = 'Sell mode: amount is treated as a SOL-denominated target. Use this when you want a quoted SOL exit size.';
    return;
  }

  elements.amountModeHint.textContent = 'Sell mode: amount is treated as token units or a balance percentage such as 25%.';
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

async function loadRuntime() {
  const { body } = await requestJson('/api/runtime');
  state.runtime = body.runtime;
  elements.title.textContent = state.runtime.title;
  elements.subtitle.textContent = `Local relay on port ${state.runtime.port}. API key stays server-side.`;
  elements.pool.value = state.runtime.defaultPool;
  elements.configState.textContent = state.runtime.hasApiKey
    ? 'API key loaded from .env'
    : 'Missing CORTO_API_KEY in .env';
  elements.configState.dataset.tone = state.runtime.hasApiKey ? 'ok' : 'bad';
  updateAmountModeHint();
  setStatus(state.runtime.hasApiKey ? 'Ready to send lightning trades.' : 'Server started, but trading is disabled until CORTO_API_KEY is set.', state.runtime.hasApiKey ? 'ok' : 'bad');
}

async function submitTrade(event) {
  event.preventDefault();
  const payload = buildPayload();
  state.lastTradePayload = payload;
  setStatus('Submitting trade to local relay...', 'progress');
  setOutput({ submitting: payload });

  try {
    const { response, body } = await requestJson('/api/trade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    setOutput(body);

    if (!response.ok || body?.success === false) {
      state.lastTradeSignature = '';
      elements.signature.textContent = 'No confirmed transaction yet';
      setStatus(body?.error?.message || `HTTP ${response.status}`, 'bad');
      return;
    }

    state.lastTradeSignature = body.txSignature || '';
    elements.signature.textContent = state.lastTradeSignature || 'Signature not returned';
    setStatus(`Trade accepted. Signature: ${state.lastTradeSignature}`, 'ok');
  } catch (error) {
    state.lastTradeSignature = '';
    elements.signature.textContent = 'No confirmed transaction yet';
    setOutput({ success: false, error: { message: error.message } });
    setStatus(error.message, 'bad');
  }
}

async function refreshStatus() {
  if (!state.lastTradeSignature) {
    setStatus('Submit a trade before requesting tx status.', 'bad');
    return;
  }

  setStatus('Loading transaction status...', 'progress');

  try {
    const { response, body } = await requestJson(`/api/status/${encodeURIComponent(state.lastTradeSignature)}`);
    setOutput(body);
    setStatus(response.ok && body?.success !== false ? 'Status updated.' : (body?.error?.message || `HTTP ${response.status}`), response.ok && body?.success !== false ? 'ok' : 'bad');
  } catch (error) {
    setOutput({ success: false, error: { message: error.message } });
    setStatus(error.message, 'bad');
  }
}

elements.form.addEventListener('submit', submitTrade);
elements.refreshStatusButton.addEventListener('click', refreshStatus);
elements.action.addEventListener('change', updateAmountModeHint);
elements.denominatedInSol.addEventListener('change', updateAmountModeHint);

loadRuntime().catch((error) => {
  setOutput({ success: false, error: { message: error.message } });
  setStatus(error.message, 'bad');
});