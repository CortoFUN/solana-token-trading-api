const LIGHTNING_API_KEY_STORAGE = 'corto-fluxboard-lightning-api-key-v20260402';

const CREATE_PLATFORM_META = Object.freeze({
  pump: Object.freeze({
    subtitle: 'Pump Fun launch with cashback and optional dev buy.'
  }),
  letsbonk: Object.freeze({
    subtitle: 'LetsBonk launch with selectable migrate mode and optional dev buy.'
  })
});

const CLAIM_PLATFORM_META = Object.freeze({
  pump: Object.freeze({
    subtitle: 'Pump Fun cashback from the same desk.'
  }),
  letsbonk: Object.freeze({
    subtitle: 'LetsBonk creator fee from the same desk.'
  })
});

const launchElements = {
  launchApiKey: document.getElementById('launchApiKey'),
  title: document.getElementById('launchTitle'),
  subtitle: document.getElementById('launchSubtitle'),
  claimSubtitle: document.getElementById('claimSubtitle'),
  createForm: document.getElementById('createForm'),
  createPlatform: document.getElementById('createPlatform'),
  createPlatformButtons: [...document.querySelectorAll('[data-platform-target="create"]')],
  createPlatformFields: [...document.querySelectorAll('.launch-platform-field')],
  createMigrateType: document.getElementById('createMigrateType'),
  createCashbackEnabled: document.getElementById('createCashbackEnabled'),
  createDevBuyEnabled: document.getElementById('createDevBuyEnabled'),
  createDevBuySol: document.getElementById('createDevBuySol'),
  createDevBuySolField: document.getElementById('createDevBuySolField'),
  createImage: document.getElementById('createImage'),
  createImageCard: document.getElementById('createImageCard'),
  createImageEmpty: document.getElementById('createImageEmpty'),
  createImageThumb: document.getElementById('createImageThumb'),
  createImageOverlay: document.getElementById('createImageOverlay'),
  createImageRemove: document.getElementById('createImageRemove'),
  createImageNote: document.getElementById('createImageNote'),
  createStatusBar: document.getElementById('createStatusBar'),
  createStatusText: document.getElementById('createStatusText'),
  createSignature: document.getElementById('createSignature'),
  createSolscan: document.getElementById('createSolscan'),
  claimForm: document.getElementById('claimForm'),
  claimPlatform: document.getElementById('claimPlatform'),
  claimPlatformButtons: [...document.querySelectorAll('[data-platform-target="claim"]')],
  claimStatusBar: document.getElementById('claimStatusBar'),
  claimStatusText: document.getElementById('claimStatusText'),
  claimSignature: document.getElementById('claimSignature'),
  claimSolscan: document.getElementById('claimSolscan'),
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

function shortenValue(value, head = 8, tail = 6) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '—';
  }

  if (normalized.length <= head + tail + 3) {
    return normalized;
  }

  return `${normalized.slice(0, head)}...${normalized.slice(-tail)}`;
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

function setInlineTone(barNode, tone) {
  if (!barNode) {
    return;
  }

  barNode.dataset.tone = tone;
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

function syncPlatformButtons(buttons, currentValue) {
  buttons.forEach((button) => {
    const isActive = button.dataset.platformValue === currentValue;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function applyPlatformRules() {
  const platform = launchElements.createPlatform.value;
  const isDevBuyEnabled = launchElements.createDevBuyEnabled.value === 'true';

  syncPlatformButtons(launchElements.createPlatformButtons, platform);

  launchElements.createPlatformFields.forEach((field) => {
    field.hidden = field.dataset.platformVisible !== platform;
  });

  launchElements.createDevBuySolField.hidden = !isDevBuyEnabled;

  if (launchElements.subtitle) {
    launchElements.subtitle.textContent = CREATE_PLATFORM_META[platform]?.subtitle || CREATE_PLATFORM_META.pump.subtitle;
  }
}

function applyClaimPlatformRules() {
  const platform = launchElements.claimPlatform.value;
  syncPlatformButtons(launchElements.claimPlatformButtons, platform);

  if (launchElements.claimSubtitle) {
    launchElements.claimSubtitle.textContent = CLAIM_PLATFORM_META[platform]?.subtitle || CLAIM_PLATFORM_META.pump.subtitle;
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
  const platform = launchElements.createPlatform.value;
  const devBuyEnabled = launchElements.createDevBuyEnabled.value;

  form.append('platform', platform);
  form.append('name', document.getElementById('createName').value.trim());
  form.append('symbol', document.getElementById('createSymbol').value.trim());
  form.append('description', document.getElementById('createDescription').value.trim());
  form.append('website', document.getElementById('createWebsite').value.trim());
  form.append('twitter', document.getElementById('createTwitter').value.trim());
  form.append('telegram', document.getElementById('createTelegram').value.trim());
  form.append('devBuyEnabled', devBuyEnabled);

  if (platform === 'letsbonk') {
    form.append('migrateType', launchElements.createMigrateType.value);
  }

  if (platform === 'pump') {
    form.append('cashbackEnabled', launchElements.createCashbackEnabled.value);
  }

  const devBuySol = launchElements.createDevBuySol.value.trim();
  if (devBuyEnabled === 'true' && devBuySol) {
    form.append('devBuySol', devBuySol);
  }

  const file = launchElements.createImage.files[0];
  if (file) {
    form.append('image', file, file.name);
  }

  return form;
}

async function loadRuntime() {
  await requestJson('/api/runtime');
  if (launchElements.title) {
    launchElements.title.textContent = 'Token create';
  }
  loadLaunchApiKey();
  applyPlatformRules();
  applyClaimPlatformRules();
  setInlineTone(launchElements.createStatusBar, 'idle');
  setInlineTone(launchElements.claimStatusBar, 'idle');
}

async function submitCreate(event) {
  event.preventDefault();
  const apiKey = launchElements.launchApiKey.value.trim();
  const form = buildCreateFormData();

  if (!apiKey) {
    const message = 'Paste your Corto.Fun API key in the header before creating tokens.';
    setStatus(launchElements.createStatusText, message);
    setInlineTone(launchElements.createStatusBar, 'error');
    showToast('API key required', message, 'error');
    return;
  }

  setStatus(launchElements.createStatusText, 'Submitting launch request...');
  setInlineTone(launchElements.createStatusBar, 'progress');
  setSignature(launchElements.createSignature, launchElements.createSolscan, '', 'No signature yet.');

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
      setInlineTone(launchElements.createStatusBar, 'error');
      showToast('Launch failed', `${name || 'Token'} could not be submitted: ${message}`, 'error');
      return;
    }

    const signature = body.txSignature || body.txSignatures?.[0] || '';
    const name = form.get('name') || 'Token';
    const platform = form.get('platform') || 'pump';
    setStatus(launchElements.createStatusText, 'Launch submitted successfully.');
    setInlineTone(launchElements.createStatusBar, 'success');
    setSignature(launchElements.createSignature, launchElements.createSolscan, signature, 'Signature not returned.');
    showToast('Launch submitted', `${name} is now in the ${platform} queue.${signature ? ` Signature ${shortenValue(signature)}.` : ''}`);
  } catch (error) {
    setStatus(launchElements.createStatusText, error.message);
    setInlineTone(launchElements.createStatusBar, 'error');
    showToast('Launch failed', `The create request stopped before submission: ${error.message}`, 'error');
  }
}

async function submitClaim(event) {
  event.preventDefault();
  const platform = launchElements.claimPlatform.value;
  const apiKey = launchElements.launchApiKey.value.trim();

  if (!apiKey) {
    const message = 'Paste your Corto.Fun API key in the header before claiming rewards.';
    setStatus(launchElements.claimStatusText, message);
    setInlineTone(launchElements.claimStatusBar, 'error');
    showToast('API key required', message, 'error');
    return;
  }

  setStatus(launchElements.claimStatusText, 'Submitting claim request...');
  setInlineTone(launchElements.claimStatusBar, 'progress');
  setSignature(launchElements.claimSignature, launchElements.claimSolscan, '', 'No claim signature yet.');

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
      setInlineTone(launchElements.claimStatusBar, 'error');
      showToast('Claim failed', `${platform} reward claim was rejected: ${message}`, 'error');
      return;
    }

    const signature = body.txSignature || '';
    setStatus(launchElements.claimStatusText, 'Claim submitted successfully.');
    setInlineTone(launchElements.claimStatusBar, 'success');
    setSignature(launchElements.claimSignature, launchElements.claimSolscan, signature, 'Signature not returned.');
    showToast('Claim submitted', `${platform} reward claim is on the way.${signature ? ` Signature ${shortenValue(signature)}.` : ''}`);
  } catch (error) {
    setStatus(launchElements.claimStatusText, error.message);
    setInlineTone(launchElements.claimStatusBar, 'error');
    showToast('Claim failed', `The reward claim could not be sent: ${error.message}`, 'error');
  }
}

launchElements.createPlatformButtons.forEach((button) => {
  button.addEventListener('click', () => {
    launchElements.createPlatform.value = button.dataset.platformValue || 'pump';
    applyPlatformRules();
  });
});
launchElements.claimPlatformButtons.forEach((button) => {
  button.addEventListener('click', () => {
    launchElements.claimPlatform.value = button.dataset.platformValue || 'pump';
    applyClaimPlatformRules();
  });
});
launchElements.createDevBuyEnabled.addEventListener('change', applyPlatformRules);
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
  setStatus(launchElements.createStatusText, error.message);
  setStatus(launchElements.claimStatusText, error.message);
  setInlineTone(launchElements.createStatusBar, 'error');
  setInlineTone(launchElements.claimStatusBar, 'error');
  showToast('Runtime error', error.message, 'error');
});