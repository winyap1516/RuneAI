// 统一存储适配器（localAdapter 实现），后续可扩展为 supabaseAdapter
// 中文注释：当前阶段仅抽象接口并提供基于 localStorage 的实现

function safeLoad(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function safeSave(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

const KEYS = { subs: 'rune_subscriptions', digests: 'rune_digests' };

export const storageAdapter = {
  // 订阅：读取/写入/删除
  loadSubscriptions() {
    return safeLoad(KEYS.subs, []);
  },
  saveSubscription(sub) {
    const subs = safeLoad(KEYS.subs, []);
    const byId = (s) => String(s.id) === String(sub.id);
    const byUrl = (s) => String((s.url||'').trim()) === String((sub.url||'').trim());
    const idx = subs.findIndex(s => byId(s) || byUrl(s));
    if (idx !== -1) subs[idx] = { ...subs[idx], ...sub };
    else subs.push(sub);
    safeSave(KEYS.subs, subs);
    return sub;
  },
  deleteSubscription(subIdOrUrl) {
    const subs = safeLoad(KEYS.subs, []);
    const left = subs.filter(s => String(s.id) !== String(subIdOrUrl) && String((s.url||'').trim()) !== String(String(subIdOrUrl||'').trim()));
    safeSave(KEYS.subs, left);
    return left.length;
  },

  // Digest：读取/写入/删除
  loadDigests() {
    return safeLoad(KEYS.digests, []);
  },
  saveDigest(digest) {
    const arr = safeLoad(KEYS.digests, []);
    let idx = -1;
    if (digest?.id) idx = arr.findIndex(d => d.id === digest.id);
    if (idx === -1 && digest?.merged && digest?.date) {
      idx = arr.findIndex(d => d.merged === true && d.date === digest.date);
    }
    if (idx !== -1) arr[idx] = { ...arr[idx], ...digest };
    else arr.push(digest);
    safeSave(KEYS.digests, arr);
    return digest;
  },
  deleteDigest(id) {
    const arr = safeLoad(KEYS.digests, []);
    const left = arr.filter(d => d.id !== id);
    safeSave(KEYS.digests, left);
    return left.length;
  }
};

export default storageAdapter;
