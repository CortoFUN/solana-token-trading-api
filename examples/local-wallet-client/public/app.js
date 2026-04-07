const state = {
  runtime: null,
  builtTransactionBase64: '',
  lastSignature: ''
};

const elements = {
  title: document.getElementById('title'),
  subtitle: document.getElementById('subtitle'),
  output: document.getElementById('output'),
  status: document.getElementById('statusBox'),
  action: document.getElementById('action'),
  pool: document.getElementById('pool'),
  denominatedInSol: document.getElementById('denominatedInSol'),
  amountModeHint: document.getElementById('amountModeHint'),
  publicKey: document.getElementById('publicKey'),
  buildForm: document.getElementById('buildForm'),
  connectWalletBtn: document.getElementById('connectWalletBtn'),
  sendBuiltTxBtn: document.getElementById('sendBuiltTxBtn'),
  refreshStatusButton: document.getElementById('refreshStatusButton'),
  signature: document.getElementById('signature')
};

function setStatus(message, tone = 'neutral') {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function setOutput(payload) {
  elements.output.textContent = JSON.stringify(payload, null, 2);
}

function requirePhantom() {
  if (!window.solana || !window.solana.isPhantom) {
    throw new Error('Phantom wallet was not detected in this browser.');
  }

  return window.solana;
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function buildPayload() {
  const action = elements.action.value;
  return {
    publicKey: elements.publicKey.value.trim(),
    action,
    mint: document.getElementById('mint').value.trim(),
    amount: document.getElementById('amount').value.trim(),
    denominatedInSol: elements.denominatedInSol.value === 'true',
    slippage: Number(document.getElementById('slippage').value || 5),
    pool: elements.pool.value,
    priorityFeeSol: document.getElementById('priorityFeeSol').value ? Number(document.getElementById('priorityFeeSol').value) : undefined,
    memo: document.getElementById('memo').value.trim() || undefined
  };
}

function updateAmountModeHint() {
  const isBuy = elements.action.value === 'buy';
  const isSolMode = elements.denominatedInSol.value === 'true';

  if (isBuy && isSolMode) {
    elements.amountModeHint.textContent = 'Buy mode: amount is treated as a SOL budget. Example: 0.1 spends about 0.1 SOL.';
    return;
  }

  if (isBuy) {
    elements.amountModeHint.textContent = 'Buy mode: amount is treated as token units. Use this when you want an exact token quantity instead of a SOL budget.';
    return;
  }

  if (isSolMode) {
    elements.amountModeHint.textContent = 'Sell mode: amount is treated as a SOL-denominated target. Use this when you want to exit for a quoted SOL value.';
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
  elements.subtitle.textContent = `Local unsigned-transaction builder on port ${state.runtime.port}. Signing stays inside Phantom.`;
  elements.pool.value = state.runtime.defaultPool;
  updateAmountModeHint();
  setStatus('Connect Phantom, then build an unsigned transaction through the local relay.', 'ok');
}

async function connectWallet() {
  try {
    const provider = requirePhantom();
    const result = await provider.connect();
    elements.publicKey.value = result.publicKey.toBase58();
    setStatus(`Connected wallet ${result.publicKey.toBase58()}`, 'ok');
  } catch (error) {
    setStatus(error.message, 'bad');
  }
}

async function buildTransaction(event) {
  event.preventDefault();

  if (!elements.publicKey.value.trim()) {
    setStatus('Connect Phantom before building a transaction.', 'bad');
    return;
  }

  setStatus('Building unsigned transaction through local relay...', 'progress');
  setOutput({ submitting: buildPayload() });

  try {
    const { response, body } = await requestJson('/api/build-trade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload())
    });

    setOutput(body);

    if (!response.ok || body?.success === false) {
      state.builtTransactionBase64 = '';
      elements.sendBuiltTxBtn.disabled = true;
      setStatus(body?.error?.message || `HTTP ${response.status}`, 'bad');
      return;
    }

    state.builtTransactionBase64 = body.transaction || '';
    elements.sendBuiltTxBtn.disabled = !state.builtTransactionBase64;
    setStatus('Unsigned transaction ready. Request Phantom signature when you are ready.', 'ok');
  } catch (error) {
    state.builtTransactionBase64 = '';
    elements.sendBuiltTxBtn.disabled = true;
    setOutput({ success: false, error: { message: error.message } });
    setStatus(error.message, 'bad');
  }
}

async function signAndSendBuiltTransaction() {
  if (!state.builtTransactionBase64) {
    setStatus('Build a transaction first.', 'bad');
    return;
  }

  try {
    const provider = requirePhantom();
    const bytes = base64ToBytes(state.builtTransactionBase64);
    const transaction = window.solanaWeb3.VersionedTransaction.deserialize(bytes);
    setStatus('Requesting Phantom signature and broadcast...', 'progress');
    const result = await provider.signAndSendTransaction(transaction);
    state.lastSignature = result.signature || '';
    elements.signature.textContent = state.lastSignature || 'Signature not returned';
    setStatus(`Transaction sent: ${state.lastSignature}`, 'ok');
  } catch (error) {
    setStatus(error.message, 'bad');
  }
}

async function refreshStatus() {
  if (!state.lastSignature) {
    setStatus('Send a transaction before requesting status.', 'bad');
    return;
  }

  setStatus('Loading transaction status...', 'progress');

  try {
    const { response, body } = await requestJson(`/api/status/${encodeURIComponent(state.lastSignature)}`);
    setOutput(body);
    setStatus(response.ok && body?.success !== false ? 'Status updated.' : (body?.error?.message || `HTTP ${response.status}`), response.ok && body?.success !== false ? 'ok' : 'bad');
  } catch (error) {
    setOutput({ success: false, error: { message: error.message } });
    setStatus(error.message, 'bad');
  }
}

elements.connectWalletBtn.addEventListener('click', connectWallet);
elements.buildForm.addEventListener('submit', buildTransaction);
elements.sendBuiltTxBtn.addEventListener('click', signAndSendBuiltTransaction);
elements.refreshStatusButton.addEventListener('click', refreshStatus);
elements.action.addEventListener('change', updateAmountModeHint);
elements.denominatedInSol.addEventListener('change', updateAmountModeHint);

loadRuntime().catch((error) => {
  setOutput({ success: false, error: { message: error.message } });
  setStatus(error.message, 'bad');
});