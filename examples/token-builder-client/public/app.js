const elements = {
  title: document.getElementById('title'),
  subtitle: document.getElementById('subtitle'),
  status: document.getElementById('statusBox'),
  configState: document.getElementById('configState'),
  createForm: document.getElementById('createForm'),
  claimForm: document.getElementById('claimForm'),
  createPlatform: document.getElementById('createPlatform'),
  claimPlatform: document.getElementById('claimPlatform'),
  createSummary: document.getElementById('createSummary'),
  claimSummary: document.getElementById('claimSummary'),
  createRaw: document.getElementById('createRaw'),
  claimRaw: document.getElementById('claimRaw'),
  createStatusActions: document.getElementById('createStatusActions'),
  claimStatusActions: document.getElementById('claimStatusActions'),
  createOpenSolscan: document.getElementById('createOpenSolscan'),
  claimOpenSolscan: document.getElementById('claimOpenSolscan'),
  createCopySignature: document.getElementById('createCopySignature'),
  claimCopySignature: document.getElementById('claimCopySignature'),
  createRequestCode: document.getElementById('createRequestCode'),
  claimRequestCode: document.getElementById('claimRequestCode'),
  createSnippetCaption: document.getElementById('createSnippetCaption'),
  claimSnippetCaption: document.getElementById('claimSnippetCaption'),
  createHint: document.getElementById('createHint'),
  claimHint: document.getElementById('claimHint'),
  migrateTypeField: document.querySelector('[data-role="migrateTypeField"]'),
  migrateType: document.getElementById('migrateType'),
  cashbackField: document.querySelector('[data-role="cashbackField"]'),
  cashbackEnabled: document.getElementById('cashbackEnabled'),
  devBuyField: document.getElementById('devBuyField'),
  devBuyEnabled: document.getElementById('devBuyEnabled'),
  devBuySol: document.getElementById('devBuySol'),
  devBuyPresets: [...document.querySelectorAll('[data-dev-buy-preset]')],
  imageInput: document.getElementById('image'),
  imageCard: document.getElementById('imageCard'),
  imageEmpty: document.getElementById('imageEmpty'),
  imageThumb: document.getElementById('imageThumb'),
  imageOverlay: document.getElementById('imageOverlay'),
  imageRemove: document.getElementById('imageRemove'),
  imageNote: document.getElementById('imageNote'),
  snippetTabs: [...document.querySelectorAll('[data-snippet-tabs]')],
  copyButtons: [...document.querySelectorAll('[data-copy-target]')]
};

const state = {
  capabilities: null,
  imagePreviewUrl: null,
  snippets: {
    create: { language: 'curl' },
    claim: { language: 'curl' }
  }
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function copyText(text) {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return false;
  }

  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(normalized);
    return true;
  }

  const area = document.createElement('textarea');
  area.value = normalized;
  area.setAttribute('readonly', 'readonly');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
  return true;
}

function setTemporaryButtonText(button, text) {
  if (!button) {
    return;
  }

  const original = button.dataset.originalText || button.textContent;
  button.dataset.originalText = original;
  button.textContent = text;

  window.setTimeout(() => {
    button.textContent = original;
  }, 1200);
}

function setStatus(message, tone = 'neutral') {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function setRaw(target, payload) {
  target.textContent = JSON.stringify(payload, null, 2);
}

function applyHighlightRules(text) {
  return text
    .replace(/("[^"]*?"|'[^']*?')/g, '<span class="token-string">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token-number">$1</span>')
    .replace(/\b(true|false|null|True|False|None)\b/g, '<span class="token-constant">$1</span>')
    .replace(/\b(const|let|await|async|import|from|print|package|func|return|new|requests|fetch|json|map|string|bytes|http|io|fmt|curl|curl_init|json_encode)\b/g, '<span class="token-keyword">$1</span>')
    .replace(/\b([A-Za-z_][A-Za-z0-9_]*)\s*(?=:)/g, '<span class="token-property">$1</span>')
    .replace(/\b([A-Za-z_][A-Za-z0-9_]*)\s*(?=\()/g, '<span class="token-function">$1</span>')
    .replace(/(\$[A-Za-z_][A-Za-z0-9_]*)/g, '<span class="token-variable">$1</span>');
}

function highlightCommon(code) {
  const stringPlaceholderPrefix = '__TOKEN_STRING_';
  const stringPlaceholders = [];
  const withHiddenStrings = code.replace(/("[^"]*?"|'[^']*?')/g, (match) => {
    const placeholder = `${stringPlaceholderPrefix}${stringPlaceholders.length}__`;
    stringPlaceholders.push(`<span class="token-string">${match}</span>`);
    return placeholder;
  });

  const highlighted = applyHighlightRules(withHiddenStrings);
  return highlighted.replace(/__TOKEN_STRING_(\d+)__/g, (_, index) => stringPlaceholders[Number(index)] || '');
}

function highlightCode(code, language) {
  const escaped = escapeHtml(code);
  const lines = escaped.split('\n').map((line) => {
    const trimmed = line.trimStart();

    if (language === 'python' || language === 'curl') {
      if (trimmed.startsWith('#')) {
        return `<span class="token-comment">${line}</span>`;
      }
    } else if (trimmed.startsWith('//')) {
      return `<span class="token-comment">${line}</span>`;
    }

    let highlightedLine = highlightCommon(line)
      .replace(/\b(--[A-Za-z-]+|-H|-d)\b/g, '<span class="token-operator">$1</span>')
      .replace(/\bhttps?:\/\/[^\s'\"]+/g, '<span class="token-string">$&</span>');

    if (language === 'python' || language === 'curl') {
      highlightedLine = highlightedLine.replace(/(\s)(#.*)$/g, '$1<span class="token-comment">$2</span>');
    } else {
      highlightedLine = highlightedLine.replace(/(\s)(\/\/.*)$/g, '$1<span class="token-comment">$2</span>');
    }

    return highlightedLine;
  });

  return lines.join('\n');
}

function renderCodeBlock(target, rawCode, language) {
  if (!target) {
    return;
  }

  target.dataset.rawCode = rawCode;
  target.dataset.language = language;
  target.innerHTML = highlightCode(rawCode, language);
}

function renderResponseStatus(summaryNode, actionsNode, solscanNode, copyNode, signature, fallbackMessage) {
  if (!summaryNode) {
    return;
  }

  if (!signature) {
    summaryNode.textContent = fallbackMessage || '—';
    if (actionsNode) {
      actionsNode.hidden = true;
      actionsNode.setAttribute('aria-hidden', 'true');
    }
    if (solscanNode) {
      solscanNode.removeAttribute('href');
    }
    if (copyNode) {
      delete copyNode.dataset.signature;
    }
    return;
  }

  summaryNode.innerHTML = `<span class="status-detail"><span>txSignature:</span><span class="status-signature">${escapeHtml(signature)}</span></span>`;
  if (actionsNode) {
    actionsNode.hidden = false;
    actionsNode.setAttribute('aria-hidden', 'false');
  }
  if (solscanNode) {
    solscanNode.href = `https://solscan.io/tx/${encodeURIComponent(signature)}`;
  }
  if (copyNode) {
    copyNode.dataset.signature = signature;
  }
}

function formatImageTypes(types) {
  return (types || []).map((type) => type.replace('image/', '').toUpperCase()).join(', ');
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 MB';
  }

  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

function getPlatformSpec(platform) {
  return state.capabilities?.platforms?.find((item) => item.id === platform) || null;
}

function escapeSingleQuotes(value) {
  return String(value).replace(/'/g, "\\'");
}

function formatValue(language, value) {
  if (typeof value === 'string') {
    const escaped = escapeSingleQuotes(value);
    if (language === 'python') return `'${escaped}'`;
    if (language === 'php') return `'${escaped}'`;
    if (language === 'go') return `"${String(value).replace(/"/g, '\\"')}"`;
    return `'${escaped}'`;
  }

  if (typeof value === 'boolean') {
    if (language === 'python') return value ? 'True' : 'False';
    if (language === 'php') return value ? 'true' : 'false';
    return value ? 'true' : 'false';
  }

  return String(value);
}

function getCreateImageName() {
  return elements.imageInput.files?.[0]?.name || 'token-image.png';
}

function getCreateValues() {
  const formData = new FormData(elements.createForm);
  const platform = String(formData.get('platform') || 'pump').trim();
  const devBuyEnabled = Boolean(formData.get('devBuyEnabled'));
  const devBuySol = String(formData.get('devBuySol') || '').trim();
  const values = {
    platform,
    name: String(formData.get('name') || '').trim() || 'Corto Nova',
    symbol: String(formData.get('symbol') || '').trim() || 'NOVA',
    description: String(formData.get('description') || '').trim() || 'Example launch from the local Corto token builder relay',
    website: String(formData.get('website') || '').trim(),
    twitter: String(formData.get('twitter') || '').trim(),
    telegram: String(formData.get('telegram') || '').trim(),
    devBuyEnabled,
    devBuySol: devBuyEnabled ? (devBuySol || '0.001') : '',
    imageName: getCreateImageName()
  };

  if (platform === 'pump') {
    values.cashbackEnabled = Boolean(formData.get('cashbackEnabled'));
  }

  if (platform === 'letsbonk') {
    values.migrateType = String(formData.get('migrateType') || 'amm').trim() || 'amm';
  }

  return values;
}

function getClaimValues() {
  const formData = new FormData(elements.claimForm);
  return {
    platform: String(formData.get('platform') || 'pump').trim() || 'pump'
  };
}

function buildCreateFields() {
  const values = getCreateValues();
  const fields = [
    ['platform', values.platform],
    ['name', values.name],
    ['symbol', values.symbol],
    ['description', values.description]
  ];

  if (values.website) fields.push(['website', values.website]);
  if (values.twitter) fields.push(['twitter', values.twitter]);
  if (values.telegram) fields.push(['telegram', values.telegram]);
  if (values.devBuyEnabled) {
    fields.push(['devBuyEnabled', true]);
    fields.push(['devBuySol', values.devBuySol]);
  }
  if (values.platform === 'pump') fields.push(['cashbackEnabled', values.cashbackEnabled]);
  if (values.platform === 'letsbonk') fields.push(['migrateType', values.migrateType]);

  return { values, fields };
}

function buildCreateCurlSnippet() {
  const { fields, values } = buildCreateFields();
  const lines = [
    '# Create token through the local relay.',
    '# Metadata, image, and platform-specific fields are sent together.',
    'curl --request POST \\',
    `  --url '${window.location.origin}/api/create' \\`,
  ];

  fields.forEach(([key, value]) => {
    lines.push(`  --form '${key}=${String(value)}' \\`);
  });

  lines.push(`  --form 'image=@${values.imageName};type=image/png'`);
  return lines.join('\n');
}

function buildCreateJavaScriptSnippet() {
  const { fields, values } = buildCreateFields();
  const lines = [
    '// Create token through the local relay.',
    'const form = new FormData();'
  ];

  fields.forEach(([key, value]) => {
    lines.push(`form.append('${key}', ${formatValue('javascript', value)});`);
  });

  lines.push(`form.append('image', fileInput.files[0] || new File([], '${escapeSingleQuotes(values.imageName)}'));`);
  lines.push('');
  lines.push(`const response = await fetch('${window.location.origin}/api/create', {`);
  lines.push("  method: 'POST',");
  lines.push('  body: form');
  lines.push('});');
  lines.push('');
  lines.push('const data = await response.json();');
  lines.push('console.log(data);');
  return lines.join('\n');
}

function buildCreatePythonSnippet() {
  const { fields, values } = buildCreateFields();
  const lines = [
    'import requests',
    '',
    'data = {'
  ];

  fields.forEach(([key, value]) => {
    lines.push(`    '${key}': ${formatValue('python', value)},`);
  });

  lines.push('}');
  lines.push(`files = { 'image': ('${escapeSingleQuotes(values.imageName)}', open('${escapeSingleQuotes(values.imageName)}', 'rb'), 'image/png') }`);
  lines.push('');
  lines.push(`response = requests.post('${window.location.origin}/api/create', data=data, files=files, timeout=30)`);
  lines.push('print(response.json())');
  return lines.join('\n');
}

function buildCreatePhpSnippet() {
  const { fields, values } = buildCreateFields();
  const lines = [
    '<?php',
    '$payload = ['
  ];

  fields.forEach(([key, value]) => {
    lines.push(`    '${key}' => ${formatValue('php', value)},`);
  });

  lines.push(`    'image' => new CURLFile('${escapeSingleQuotes(values.imageName)}', 'image/png', '${escapeSingleQuotes(values.imageName)}'),`);
  lines.push('];');
  lines.push('$ch = curl_init();');
  lines.push(`curl_setopt($ch, CURLOPT_URL, '${window.location.origin}/api/create');`);
  lines.push('curl_setopt($ch, CURLOPT_POST, true);');
  lines.push('curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);');
  lines.push('curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);');
  lines.push('$response = curl_exec($ch);');
  lines.push('curl_close($ch);');
  lines.push('echo $response;');
  return lines.join('\n');
}

function buildCreateGoSnippet() {
  const { fields, values } = buildCreateFields();
  const lines = [
    'package main',
    '',
    'import (',
    '  "bytes"',
    '  "io"',
    '  "mime/multipart"',
    '  "net/http"',
    '  "os"',
    ')',
    '',
    'func main() {',
    '  var body bytes.Buffer',
    '  writer := multipart.NewWriter(&body)'
  ];

  fields.forEach(([key, value]) => {
    lines.push(`  writer.WriteField("${key}", ${formatValue('go', String(value))})`);
  });

  lines.push(`  fileWriter, _ := writer.CreateFormFile("image", "${String(values.imageName).replace(/"/g, '\\"')}")`);
  lines.push(`  file, _ := os.Open("${String(values.imageName).replace(/"/g, '\\"')}")`);
  lines.push('  defer file.Close()');
  lines.push('  _, _ = io.Copy(fileWriter, file)');
  lines.push('  writer.Close()');
  lines.push(`  req, _ := http.NewRequest("POST", "${window.location.origin}/api/create", &body)`);
  lines.push('  req.Header.Set("Content-Type", writer.FormDataContentType())');
  lines.push('  client := &http.Client{}');
  lines.push('  client.Do(req)');
  lines.push('}');
  return lines.join('\n');
}

function buildClaimJsonBody(indent = 2) {
  return JSON.stringify({ platform: getClaimValues().platform }, null, indent);
}

function buildClaimCurlSnippet() {
  return [
    '# Claim cashback or creator fee through the local relay.',
    'curl --request POST \\',
    `  --url '${window.location.origin}/api/claim' \\`,
    "  --header 'Content-Type: application/json' \\",
    `  --data '${buildClaimJsonBody(0)}'`
  ].join('\n');
}

function buildClaimJavaScriptSnippet() {
  return [
    '// Claim reward flow for the selected platform.',
    `const response = await fetch('${window.location.origin}/api/claim', {`,
    "  method: 'POST',",
    "  headers: { 'Content-Type': 'application/json' },",
    `  body: JSON.stringify(${buildClaimJsonBody(2)})`,
    '});',
    '',
    'const data = await response.json();',
    'console.log(data);'
  ].join('\n');
}

function buildClaimPythonSnippet() {
  return [
    'import requests',
    '',
    `payload = ${buildClaimJsonBody(2)}`,
    '',
    `response = requests.post('${window.location.origin}/api/claim', json=payload, timeout=30)`,
    'print(response.json())'
  ].join('\n');
}

function buildClaimPhpSnippet() {
  return [
    '<?php',
    `$payload = '${buildClaimJsonBody(0).replace(/'/g, "\\'")}';`,
    '$ch = curl_init();',
    `curl_setopt($ch, CURLOPT_URL, '${window.location.origin}/api/claim');`,
    'curl_setopt($ch, CURLOPT_POST, true);',
    'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);',
    "curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);",
    'curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);',
    '$response = curl_exec($ch);',
    'curl_close($ch);',
    'echo $response;'
  ].join('\n');
}

function buildClaimGoSnippet() {
  return [
    'package main',
    '',
    'import (',
    '  "bytes"',
    '  "net/http"',
    ')',
    '',
    'func main() {',
    `  body := []byte(${formatValue('go', buildClaimJsonBody(0))})`,
    `  req, _ := http.NewRequest("POST", "${window.location.origin}/api/claim", bytes.NewBuffer(body))`,
    '  req.Header.Set("Content-Type", "application/json")',
    '  client := &http.Client{}',
    '  client.Do(req)',
    '}'
  ].join('\n');
}

function renderSnippet(kind) {
  const language = state.snippets[kind].language;
  let code = '';

  if (kind === 'create') {
    if (language === 'curl') code = buildCreateCurlSnippet();
    if (language === 'javascript') code = buildCreateJavaScriptSnippet();
    if (language === 'python') code = buildCreatePythonSnippet();
    if (language === 'php') code = buildCreatePhpSnippet();
    if (language === 'go') code = buildCreateGoSnippet();
    renderCodeBlock(elements.createRequestCode, code, language);
    elements.createSnippetCaption.textContent = 'Snippet follows the current create form values and image placeholder.';
    return;
  }

  if (language === 'curl') code = buildClaimCurlSnippet();
  if (language === 'javascript') code = buildClaimJavaScriptSnippet();
  if (language === 'python') code = buildClaimPythonSnippet();
  if (language === 'php') code = buildClaimPhpSnippet();
  if (language === 'go') code = buildClaimGoSnippet();
  renderCodeBlock(elements.claimRequestCode, code, language);
  elements.claimSnippetCaption.textContent = 'Snippet follows the current claim values and selected language.';
}

function initSnippetTabs() {
  elements.snippetTabs.forEach((tabsNode) => {
    const kind = tabsNode.dataset.snippetTabs;
    const defaultLanguage = tabsNode.dataset.defaultLanguage || 'curl';
    state.snippets[kind].language = defaultLanguage;

    const buttons = [...tabsNode.querySelectorAll('.request-tab')];
    const sync = () => {
      buttons.forEach((button) => button.classList.toggle('active', button.dataset.language === state.snippets[kind].language));
      renderSnippet(kind);
    };

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        state.snippets[kind].language = button.dataset.language || defaultLanguage;
        sync();
      });
    });

    sync();
  });
}

function setFieldVisibility(element, isVisible) {
  if (!element) {
    return;
  }

  element.hidden = !isVisible;
  element.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
}

function revokeImagePreview() {
  if (state.imagePreviewUrl) {
    URL.revokeObjectURL(state.imagePreviewUrl);
    state.imagePreviewUrl = null;
  }
}

function setImageFieldInvalid(isInvalid) {
  elements.imageCard.classList.toggle('field-invalid', isInvalid);
}

function clearSelectedImage() {
  revokeImagePreview();
  elements.imageInput.value = '';
  elements.imageEmpty.hidden = false;
  elements.imageThumb.removeAttribute('src');
  elements.imageThumb.hidden = true;
  elements.imageOverlay.hidden = true;
  elements.imageRemove.hidden = true;
  setImageFieldInvalid(false);
  renderSnippet('create');
}

function setSelectedImage(file) {
  revokeImagePreview();
  state.imagePreviewUrl = URL.createObjectURL(file);
  elements.imageThumb.src = state.imagePreviewUrl;
  elements.imageEmpty.hidden = true;
  elements.imageThumb.hidden = false;
  elements.imageOverlay.hidden = false;
  elements.imageRemove.hidden = false;
  setImageFieldInvalid(false);
  renderSnippet('create');
}

function handleImageSelection(fileList) {
  const file = fileList?.[0];
  if (!file) {
    clearSelectedImage();
    return;
  }

  const transfer = new DataTransfer();
  transfer.items.add(file);
  elements.imageInput.files = transfer.files;
  setSelectedImage(file);
}

function validateRequiredFields(form) {
  const requiredFields = [...form.querySelectorAll('[required]')];
  let firstInvalid = null;

  requiredFields.forEach((field) => {
    const isEmpty = field.type === 'file' ? !field.files?.length : !String(field.value || '').trim();
    field.classList.toggle('field-invalid', isEmpty);
    if (field === elements.imageInput) {
      setImageFieldInvalid(isEmpty);
    }
    if (isEmpty && !firstInvalid) {
      firstInvalid = field;
    }
  });

  if (!firstInvalid) {
    return true;
  }

  if (firstInvalid === elements.imageInput) {
    elements.imageCard.focus();
  } else {
    firstInvalid.focus();
  }
  return false;
}

function syncDevBuyField() {
  const isEnabled = Boolean(elements.devBuyEnabled.checked);
  setFieldVisibility(elements.devBuyField, isEnabled);
  elements.devBuySol.disabled = !isEnabled;

  if (isEnabled && !String(elements.devBuySol.value || '').trim()) {
    elements.devBuySol.value = '0.001';
  }
  if (!isEnabled) {
    elements.devBuySol.value = '';
  }

  elements.devBuyPresets.forEach((button) => {
    const isActive = isEnabled && String(elements.devBuySol.value || '').trim() === String(button.dataset.devBuyPreset || '');
    button.classList.toggle('active', isActive);
  });
}

function syncCreateFields() {
  const platform = elements.createPlatform.value;
  const spec = getPlatformSpec(platform);
  const isLetsbonk = platform === 'letsbonk';

  setFieldVisibility(elements.migrateTypeField, isLetsbonk);
  elements.migrateType.disabled = !isLetsbonk;
  setFieldVisibility(elements.cashbackField, !isLetsbonk);
  elements.cashbackEnabled.disabled = isLetsbonk;
  if (isLetsbonk) {
    elements.cashbackEnabled.checked = false;
  }

  elements.createHint.textContent = spec
    ? `${spec.metadataFlow} ${spec.devBuyNote} Upload limits: ${state.capabilities.limits.imageTypes.join(', ')} up to ${Math.round(state.capabilities.limits.imageMaxBytes / 1024 / 1024)} MB.`
    : 'Capabilities are unavailable.';

  syncDevBuyField();
  renderSnippet('create');
}

function syncClaimHint() {
  const spec = getPlatformSpec(elements.claimPlatform.value);
  elements.claimHint.textContent = spec ? spec.claimNote : 'Capabilities are unavailable.';
  renderSnippet('claim');
}

function initCopyButtons() {
  elements.copyButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const target = document.getElementById(button.dataset.copyTarget || '');
      const payload = target?.dataset.rawCode || target?.textContent || '';

      try {
        await copyText(payload);
        setTemporaryButtonText(button, 'Copied');
      } catch {
        setTemporaryButtonText(button, 'Copy error');
      }
    });
  });
}

function initSignatureActions(copyButton) {
  if (!copyButton) {
    return;
  }

  copyButton.addEventListener('click', async () => {
    const signature = String(copyButton.dataset.signature || '').trim();
    if (!signature) {
      setTemporaryButtonText(copyButton, 'No signature');
      return;
    }

    try {
      await copyText(signature);
      setTemporaryButtonText(copyButton, 'Copied');
    } catch {
      setTemporaryButtonText(copyButton, 'Copy error');
    }
  });
}

async function loadRuntime() {
  const { body } = await requestJson('/api/runtime');
  state.capabilities = body.capabilities || null;

  elements.title.textContent = body.runtime.title;
  elements.subtitle.textContent = `Local relay on port ${body.runtime.port}. API key stays server-side in .env.`;
  elements.configState.textContent = body.runtime.hasApiKey ? 'API key loaded from .env' : 'Missing CORTO_API_KEY in .env';
  elements.configState.dataset.tone = body.runtime.hasApiKey ? 'ok' : 'bad';

  if (state.capabilities?.limits) {
    elements.imageNote.textContent = `Supported files: ${formatImageTypes(state.capabilities.limits.imageTypes)}. Max size: ${formatBytes(state.capabilities.limits.imageMaxBytes)}. The image is sent in the same multipart request as metadata.`;
  }

  setStatus(
    body.runtime.hasApiKey
      ? 'Ready for token builder requests.'
      : 'Server started, but create and claim are disabled until CORTO_API_KEY is set.',
    body.runtime.hasApiKey ? 'ok' : 'bad'
  );

  syncCreateFields();
  syncClaimHint();
  renderResponseStatus(elements.createSummary, elements.createStatusActions, elements.createOpenSolscan, elements.createCopySignature, '', 'Ready for create flow.');
  renderResponseStatus(elements.claimSummary, elements.claimStatusActions, elements.claimOpenSolscan, elements.claimCopySignature, '', 'Ready for claim flow.');
  setRaw(elements.createRaw, { success: true, capabilitiesLoaded: Boolean(state.capabilities) });
  setRaw(elements.claimRaw, { success: true, capabilitiesLoaded: Boolean(state.capabilities) });
}

async function submitCreate(event) {
  event.preventDefault();

  if (!validateRequiredFields(elements.createForm)) {
    renderResponseStatus(elements.createSummary, elements.createStatusActions, elements.createOpenSolscan, elements.createCopySignature, '', 'Fill all required fields before sending the create request.');
    setStatus('Create form has missing required fields.', 'bad');
    return;
  }

  const formData = new FormData(elements.createForm);
  setStatus('Submitting create request...', 'progress');
  renderResponseStatus(elements.createSummary, elements.createStatusActions, elements.createOpenSolscan, elements.createCopySignature, '', 'Submitting create request...');
  setRaw(elements.createRaw, { submitting: true });

  try {
    const response = await fetch('/api/create', {
      method: 'POST',
      body: formData
    });
    const body = await response.json();
    setRaw(elements.createRaw, body);

    if (!response.ok || body?.success === false) {
      setStatus(body?.error?.message || `HTTP ${response.status}`, 'bad');
      renderResponseStatus(elements.createSummary, elements.createStatusActions, elements.createOpenSolscan, elements.createCopySignature, '', body?.error?.message || `HTTP ${response.status}`);
      return;
    }

    const signature = body.txSignature || body.txSignatures?.[0] || '';
    setStatus('Create request completed.', 'ok');
    renderResponseStatus(elements.createSummary, elements.createStatusActions, elements.createOpenSolscan, elements.createCopySignature, signature, 'Create request completed.');
  } catch (error) {
    setRaw(elements.createRaw, { success: false, error: { message: error.message } });
    setStatus(error.message, 'bad');
    renderResponseStatus(elements.createSummary, elements.createStatusActions, elements.createOpenSolscan, elements.createCopySignature, '', error.message);
  }
}

async function submitClaim(event) {
  event.preventDefault();
  setStatus('Submitting claim request...', 'progress');
  renderResponseStatus(elements.claimSummary, elements.claimStatusActions, elements.claimOpenSolscan, elements.claimCopySignature, '', 'Submitting claim request...');
  setRaw(elements.claimRaw, { submitting: true });

  try {
    const { response, body } = await requestJson('/api/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ platform: elements.claimPlatform.value })
    });
    setRaw(elements.claimRaw, body);

    if (!response.ok || body?.success === false) {
      setStatus(body?.error?.message || `HTTP ${response.status}`, 'bad');
      renderResponseStatus(elements.claimSummary, elements.claimStatusActions, elements.claimOpenSolscan, elements.claimCopySignature, '', body?.error?.message || `HTTP ${response.status}`);
      return;
    }

    setStatus('Claim request completed.', 'ok');
    renderResponseStatus(elements.claimSummary, elements.claimStatusActions, elements.claimOpenSolscan, elements.claimCopySignature, body.txSignature || '', 'Claim request completed.');
  } catch (error) {
    setRaw(elements.claimRaw, { success: false, error: { message: error.message } });
    setStatus(error.message, 'bad');
    renderResponseStatus(elements.claimSummary, elements.claimStatusActions, elements.claimOpenSolscan, elements.claimCopySignature, '', error.message);
  }
}

elements.createForm.addEventListener('submit', submitCreate);
elements.claimForm.addEventListener('submit', submitClaim);
elements.createForm.addEventListener('input', () => renderSnippet('create'));
elements.createForm.addEventListener('change', () => renderSnippet('create'));
elements.claimForm.addEventListener('input', () => renderSnippet('claim'));
elements.claimForm.addEventListener('change', () => renderSnippet('claim'));
elements.createPlatform.addEventListener('change', syncCreateFields);
elements.claimPlatform.addEventListener('change', syncClaimHint);
elements.devBuyEnabled.addEventListener('change', () => {
  syncDevBuyField();
  renderSnippet('create');
});
elements.devBuySol.addEventListener('input', () => {
  syncDevBuyField();
  renderSnippet('create');
});
elements.devBuyPresets.forEach((button) => {
  button.addEventListener('click', () => {
    elements.devBuyEnabled.checked = true;
    elements.devBuySol.value = button.dataset.devBuyPreset || '';
    syncDevBuyField();
    renderSnippet('create');
  });
});
elements.imageCard.addEventListener('click', (event) => {
  if (event.target === elements.imageRemove) {
    return;
  }
  elements.imageInput.click();
});
elements.imageCard.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    elements.imageInput.click();
  }
});
elements.imageRemove.addEventListener('click', (event) => {
  event.stopPropagation();
  clearSelectedImage();
});
elements.imageInput.addEventListener('change', () => handleImageSelection(elements.imageInput.files));
['dragenter', 'dragover'].forEach((eventName) => {
  elements.imageCard.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.imageCard.classList.add('is-dragover');
  });
});
['dragleave', 'dragend', 'drop'].forEach((eventName) => {
  elements.imageCard.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.imageCard.classList.remove('is-dragover');
  });
});
elements.imageCard.addEventListener('drop', (event) => {
  handleImageSelection(event.dataTransfer?.files);
});

initCopyButtons();
initSignatureActions(elements.createCopySignature);
initSignatureActions(elements.claimCopySignature);
initSnippetTabs();
syncDevBuyField();

loadRuntime().catch((error) => {
  setStatus(error.message, 'bad');
  renderResponseStatus(elements.createSummary, elements.createStatusActions, elements.createOpenSolscan, elements.createCopySignature, '', error.message);
  renderResponseStatus(elements.claimSummary, elements.claimStatusActions, elements.claimOpenSolscan, elements.claimCopySignature, '', error.message);
  setRaw(elements.createRaw, { success: false, error: { message: error.message } });
  setRaw(elements.claimRaw, { success: false, error: { message: error.message } });
});

window.addEventListener('beforeunload', revokeImagePreview);