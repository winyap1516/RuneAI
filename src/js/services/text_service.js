// 中文注释：文本处理服务（src/js 统一路径）
// 职责：提供基础的字符串清洗、预处理与截断工具，供存储与视图层复用

export function sanitizeText(text) {
  const s = String(text ?? '').replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  return s.replace(/[\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export function preprocessText(text) {
  const s = String(text ?? '');
  return s.replace(/\s+/g, ' ').normalize('NFC').trim();
}

export function cleanTextForStorage(text) {
  return preprocessText(sanitizeText(text));
}

export function enforceFieldLengths(obj = {}, limits = {}) {
  const out = { ...obj };
  for (const [k, max] of Object.entries(limits)) {
    if (out[k] != null) out[k] = truncateText(String(out[k]), Number(max) || 0);
  }
  return out;
}

export function truncateText(text, maxLen) {
  const s = String(text ?? '');
  const n = Number(maxLen) || 0;
  if (n <= 0) return s;
  if (s.length <= n) return s;
  return s.slice(0, Math.max(0, n - 1)) + '…';
}

export default { sanitizeText, preprocessText, cleanTextForStorage, enforceFieldLengths, truncateText };
