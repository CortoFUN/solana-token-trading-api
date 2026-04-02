const LIGHTNING_API_KEY_STORAGE = 'corto-fluxboard-lightning-api-key-v20260402';

const launchElements = {
  launchApiKey: document.getElementById('launchApiKey'),
  title: document.getElementById('launchTitle'),
  subtitle: document.getElementById('launchSubtitle'),
  createForm: document.getElementById('createForm'),
  createPlatform: document.getElementById('createPlatform'),
  createMigrateType: document.getElementById('createMigrateType'),
  createCashbackEnabled: document.getElementById('createCashbackEnabled'),
  createDevBuyEnabled: document.getElementById('createDevBuyEnabled'),
  createImage: document.getElementById('createImage'),
  createImageCard: document.getElementById('createImageCard'),
  createImageEmpty: document.getElementById('createImageEmpty'),
  createImageThumb: document.getElementById('createImageThumb'),
  createImageOverlay: document.getElementById('createImageOverlay'),
  createImageRemove: document.getElementById('createImageRemove'),
  createImageNote: document.getElementById('createImageNote'),
  createStatusText: document.getElementById('createStatusText'),
  createSignature: document.getElementById('createSignature'),
  createSolscan: document.getElementById('createSolscan'),
  createOutput: document.getElementById('createOutput'),
  claimForm: document.getElementById('claimForm'),
  claimStatusText: document.getElementById('claimStatusText'),
  claimSignature: document.getElementById('claimSignature'),
  claimSolscan: document.getElementById('claimSolscan'),
  claimOutput: document.getElementById('claimOutput'),
  toastStack: document.getElementById('toastStack')
};

const launchState = {
  imagePreviewUrl: null
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
  launchElements.toastStack.prepend(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 4200);
}

function setStatus(node, message) {
  node.textContent = message;
}

function setSignature(signatureNode, solscanNode, signature, fallbackText) {
  signatureNode.textContent = signature || fallbackText;
  if (signature) {
    solscanNode.href = `https://solscan.io/tx/${encodeURIComponent(signature)}`;
    solscanNode.style.pointerEvents = 'auto';
    solscanNode.style.opacity = '1';
  } else {
    solscanNode.href = '#';
    solscanNode.style.pointerEvents = 'none';
    solscanNode.style.opacity = '0.45';
  }
}

function renderSummary(container, rows, emptyText) {
  if (!rows.length) {
    container.innerHTML = `<div class="result-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }

  container.innerHTML = rows.map((row) => `
    <div class="result-row">
      <strong>${escapeHtml(row.title)}</strong>
      <span>${escapeHtml(row.copy)}</span>
    </div>
  `).join('');
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

function persistLaunchApiKey() {
  localStorage.setItem(LIGHTNING_API_KEY_STORAGE, launchElements.launchApiKey.value.trim());
}

function loadLaunchApiKey() {
  launchElements.launchApiKey.value = localStorage.getItem(LIGHTNING_API_KEY_STORAGE) || '';
}

function applyPlatformRules() {
  const isLetsbonk = launchElements.createPlatform.value === 'letsbonk';
  launchElements.createCashbackEnabled.disabled = isLetsbonk;
  if (isLetsbonk) {
    launchElements.createCashbackEnabled.value = 'false';
  }
}

function clearImagePreview() {
  if (launchState.imagePreviewUrl) {
    URL.revokeObjectURL(launchState.imagePreviewUrl);
    launchState.imagePreviewUrl = null;
  }

  launchElements.createImageThumb.hidden = true;
  launchElements.createImageThumb.removeAttribute('src');
  launchElements.createImageOverlay.hidden = true;
  launchElements.createImageRemove.hidden = true;
  launchElements.createImageEmpty.hidden = false;
  launchElements.createImageCard.classList.remove('is-filled');
  launchElements.createImageNote.textContent = 'PNG, JPG, and WEBP work best for launch previews.';
}

function showImagePreview(file) {
  clearImagePreview();
  if (!file) {
    return;
  }

  launchState.imagePreviewUrl = URL.createObjectURL(file);
  launchElements.createImageThumb.src = launchState.imagePreviewUrl;
  launchElements.createImageThumb.hidden = false;
  launchElements.createImageOverlay.hidden = false;
  launchElements.createImageRemove.hidden = false;
  launchElements.createImageEmpty.hidden = true;
  launchElements.createImageCard.classList.add('is-filled');
  launchElements.createImageNote.textContent = `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
}

function applyImageFile(file) {
  if (!file) {
    clearImagePreview();
    return;
  }

  const transfer = new DataTransfer();
  transfer.items.add(file);
  launchElements.createImage.files = transfer.files;
  showImagePreview(file);
}

function buildCreateFormData() {
  const form = new FormData();
  form.append('platform', launchElements.createPlatform.value);
  form.append('name', document.getElementById('createName').value.trim());
  form.append('symbol', document.getElementById('createSymbol').value.trim());
  form.append('description', document.getElementById('createDescription').value.trim());
  form.append('website', document.getElementById('createWebsite').value.trim());
  form.append('twitter', document.getElementById('createTwitter').value.trim());
  form.append('telegram', document.getElementById('createTelegram').value.trim());
  form.append('migrateType', launchElements.createMigrateType.value);
  form.append('cashbackEnabled', launchElements.createCashbackEnabled.value);
  form.append('devBuyEnabled', launchElements.createDevBuyEnabled.value);

  const devBuySol = document.getElementById('createDevBuySol').value.trim();
  if (devBuySol) {
    form.append('devBuySol', devBuySol);
  }

  const file = launchElements.createImage.files[0];
  if (file) {
    form.append('image', file, file.name);
  }

  return form;
}

function summarizeCreateResponse(body, form) {
  const name = form.get('name') || 'Token';
  const symbol = form.get('symbol') || 'SYMBOL';
  const platform = form.get('platform') || 'pump';
  const devBuy = form.get('devBuySol');
  const signature = body.txSignature || body.txSignatures?.[0] || '';

  return {
    signature,
    rows: [
      { title: 'Launch submitted', copy: `${name} (${symbol}) was sent to ${platform}.` },
      { title: 'Dev buy', copy: devBuy ? `Dev buy is attached for ${devBuy} SOL.` : 'No dev buy was attached to this launch.' },
      { title: 'Next step', copy: signature ? 'Open Solscan if you want to watch confirmation.' : 'The relay did not return a signature for this launch.' }
    ]
  };
}

function summarizeClaimResponse(body, platform) {
  const signature = body.txSignature || '';
  return {
    signature,
    rows: [
      { title: 'Claim submitted', copy: `${platform === 'letsbonk' ? 'LetsBonk creator fee' : 'Pump.fun cashback'} claim was sent.` },
      { title: 'Next step', copy: signature ? 'Open Solscan if you want to watch confirmation.' : 'The relay did not return a signature for this claim.' }
    ]
  };
}

async function loadRuntime() {
  await requestJson('/api/runtime');
  launchElements.title.textContent = 'Corto.Fun StarForge';
  launchElements.subtitle.textContent = 'Create tokens, add optional dev buy, and claim rewards from one clean launch surface.';
  loadLaunchApiKey();
  applyPlatformRules();
}

async function submitCreate(event) {
  event.preventDefault();
  const apiKey = launchElements.launchApiKey.value.trim();
  const form = buildCreateFormData();

  if (!apiKey) {
    const message = 'Paste your Corto.Fun API key in the header before creating tokens.';
    setStatus(launchElements.createStatusText, message);
    renderSummary(launchElements.createOutput, [{ title: 'Launch failed', copy: message }], 'Your create summary will appear here after launch.');
    showToast('API key required', message, 'error');
    return;
  }

  setStatus(launchElements.createStatusText, 'Submitting launch request...');
  setSignature(launchElements.createSignature, launchElements.createSolscan, '', 'No signature yet.');
  renderSummary(launchElements.createOutput, [], 'Your create summary will appear here after launch.');

  try {
    const response = await fetch('/api/token-builder/create', {
      method: 'POST',
      headers: {
        'x-corto-user-api-key': apiKey
      },
      body: form
    });
    const body = await response.json();

    if (!response.ok || body?.success === false) {
      const message = body?.error?.message || `HTTP ${response.status}`;
      setStatus(launchElements.createStatusText, message);
      renderSummary(launchElements.createOutput, [{ title: 'Launch failed', copy: message }], 'Your create summary will appear here after launch.');
      showToast('Launch failed', message, 'error');
      return;
    }

    const summary = summarizeCreateResponse(body, form);
    setStatus(launchElements.createStatusText, 'Launch submitted successfully.');
    setSignature(launchElements.createSignature, launchElements.createSolscan, summary.signature, 'Signature not returned.');
    renderSummary(launchElements.createOutput, summary.rows, 'Your create summary will appear here after launch.');
    showToast('Launch submitted', summary.signature || 'Your token launch request was accepted.');
  } catch (error) {
    setStatus(launchElements.createStatusText, error.message);
    renderSummary(launchElements.createOutput, [{ title: 'Launch failed', copy: error.message }], 'Your create summary will appear here after launch.');
    showToast('Launch failed', error.message, 'error');
  }
}

async function submitClaim(event) {
  event.preventDefault();
  const platform = document.getElementById('claimPlatform').value;
  const apiKey = launchElements.launchApiKey.value.trim();

  if (!apiKey) {
    const message = 'Paste your Corto.Fun API key in the header before claiming rewards.';
    setStatus(launchElements.claimStatusText, message);
    renderSummary(launchElements.claimOutput, [{ title: 'Claim failed', copy: message }], 'Your claim summary will appear here after claim.');
    showToast('API key required', message, 'error');
    return;
  }

  setStatus(launchElements.claimStatusText, 'Submitting claim request...');
  setSignature(launchElements.claimSignature, launchElements.claimSolscan, '', 'No claim signature yet.');
  renderSummary(launchElements.claimOutput, [], 'Your claim summary will appear here after claim.');

  try {
    const { response, body } = await requestJson('/api/token-builder/claim', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-corto-user-api-key': apiKey
      },
      body: JSON.stringify({ platform })
    });

    if (!response.ok || body?.success === false) {
      const message = body?.error?.message || `HTTP ${response.status}`;
      setStatus(launchElements.claimStatusText, message);
      renderSummary(launchElements.claimOutput, [{ title: 'Claim failed', copy: message }], 'Your claim summary will appear here after claim.');
      showToast('Claim failed', message, 'error');
      return;
    }

    const summary = summarizeClaimResponse(body, platform);
    setStatus(launchElements.claimStatusText, 'Claim submitted successfully.');
    setSignature(launchElements.claimSignature, launchElements.claimSolscan, summary.signature, 'Signature not returned.');
    renderSummary(launchElements.claimOutput, summary.rows, 'Your claim summary will appear here after claim.');
    showToast('Claim submitted', summary.signature || 'Your claim request was accepted.');
  } catch (error) {
    setStatus(launchElements.claimStatusText, error.message);
    renderSummary(launchElements.claimOutput, [{ title: 'Claim failed', copy: error.message }], 'Your claim summary will appear here after claim.');
    showToast('Claim failed', error.message, 'error');
  }
}

launchElements.createPlatform.addEventListener('change', applyPlatformRules);
launchElements.createImage.addEventListener('change', () => showImagePreview(launchElements.createImage.files[0]));
launchElements.createImageCard.addEventListener('click', () => launchElements.createImage.click());
launchElements.createImageCard.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    launchElements.createImage.click();
  }
});
launchElements.createImageCard.addEventListener('dragover', (event) => {
  event.preventDefault();
  launchElements.createImageCard.classList.add('is-dragging');
});
launchElements.createImageCard.addEventListener('dragleave', () => {
  launchElements.createImageCard.classList.remove('is-dragging');
});
launchElements.createImageCard.addEventListener('drop', (event) => {
  event.preventDefault();
  launchElements.createImageCard.classList.remove('is-dragging');
  const [file] = [...(event.dataTransfer?.files || [])];
  if (file) {
    applyImageFile(file);
  }
});
launchElements.createImageRemove.addEventListener('click', (event) => {
  event.stopPropagation();
  launchElements.createImage.value = '';
  clearImagePreview();
});
launchElements.launchApiKey.addEventListener('change', persistLaunchApiKey);
launchElements.launchApiKey.addEventListener('blur', persistLaunchApiKey);
launchElements.launchApiKey.addEventListener('input', persistLaunchApiKey);
launchElements.createForm.addEventListener('submit', submitCreate);
launchElements.claimForm.addEventListener('submit', submitClaim);

loadRuntime().catch((error) => {
  renderSummary(launchElements.createOutput, [{ title: 'Runtime error', copy: error.message }], 'Your create summary will appear here after launch.');
  renderSummary(launchElements.claimOutput, [{ title: 'Runtime error', copy: error.message }], 'Your claim summary will appear here after claim.');
  setStatus(launchElements.createStatusText, error.message);
  setStatus(launchElements.claimStatusText, error.message);
  showToast('Runtime error', error.message, 'error');
});