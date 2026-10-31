function safeImageUrl(raw) {
  const value = String(raw || '').trim();
  if (!value || value.length > 2000) return '';
  if (
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !value.includes('..')
  ) {
    return value;
  }
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch {
    return '';
  }
  return '';
}

module.exports = { safeImageUrl };
