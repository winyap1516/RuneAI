export function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  
  let temp = url.trim();
  // Ensure protocol for parsing if missing, default to http
  if (!/^https?:\/\//i.test(temp)) {
    temp = 'http://' + temp;
  }

  try {
    const u = new URL(temp);
    // Host: lowercase, remove www.
    let host = u.hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    
    // Path: lowercase, remove trailing slash
    let path = u.pathname.toLowerCase();
    if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
    } else if (path === '/') {
        path = '';
    }
    
    // Reconstruct without protocol, query, or hash
    // Combine host + path
    return `${host}${path}`;
  } catch (e) {
    // Fallback simple string manipulation
    let clean = temp.toLowerCase();
    clean = clean.replace(/^https?:\/\//i, '');
    clean = clean.replace(/^www\./i, '');
    clean = clean.split('?')[0].split('#')[0];
    clean = clean.replace(/\/+$/, '');
    return clean;
  }
}

// 中文注释：将任意输入转换为绝对 URL（带协议），用于网络请求/抓取
// 规则：
// - 缺失协议时默认使用 https；可解析失败时返回空字符串避免报错
// - 保留协议、主机、路径、查询与哈希，便于后端准确抓取网页
export function ensureAbsoluteUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const guess = /^(https?:)\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(guess);
    // 规范化主机为小写（不移除 www，保留原始形态以保证抓取一致性）
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return '';
  }
}
