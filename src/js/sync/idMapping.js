// 中文注释：本地 ID 映射管理（local_id → server_id）
// 作用：维护资源在本地与服务器之间的 ID 映射，便于后续更新/删除使用服务器 UUID

const LS_KEY = 'rune_server_id_map';

function load() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}

function save(map) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)); } catch {}
}

/**
 * 设置映射
 * @param {('website'|'subscription'|'digest')} type
 * @param {string|number} localId
 * @param {string} serverId
 */
export function setMapping(type, localId, serverId) {
  const map = load();
  const t = map[type] || {};
  t[String(localId)] = String(serverId);
  map[type] = t;
  save(map);
}

/**
 * 获取服务器 ID
 * @param {('website'|'subscription'|'digest')} type
 * @param {string|number} localId
 * @returns {string|null}
 */
export function getServerId(type, localId) {
  const map = load();
  const t = map[type] || {};
  const sid = t[String(localId)] || null;
  return sid ? String(sid) : null;
}

export default { setMapping, getServerId };

