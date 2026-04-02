function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function highlightJson(value) {
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

document.querySelectorAll('pre').forEach((node) => {
  const raw = node.textContent ?? '';
  const trimmed = raw.trim();

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return;
  }

  node.innerHTML = highlightJson(raw);
});