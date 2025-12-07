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
