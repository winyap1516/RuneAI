// 中文注释：客户端变更日志（Change-log）模块
// 作用：本地优先记录 create/update/delete 变更，支持离线使用与可靠上报
// 存储：优先使用 IndexedDB 新建 store `client_changes_local`；若不可用则回退至 localStorage

import db from '../storage/db.js';

const LS_KEY = 'rune_client_changes_local';

// 生成简易 UUID（v4 近似）
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function hasIdbStore() {
  try {
    const conn = await db.openDB();
    return conn.objectStoreNames.contains('client_changes_local');
  } catch { return false; }
}

/**
 * 写入一条变更（本地）
 * @param {('website'|'subscription'|'digest')} resourceType
 * @param {('create'|'update'|'delete')} op
 * @param {string|number|null} resourceId
 * @param {object} payload
 * @param {number|null} baseServerTs
 * @returns {Promise<object>} 变更记录（含 client_change_id）
 */
export async function addChange(resourceType, op, resourceId, payload, baseServerTs = null) {
  // 中文注释：为每个字段生成时间戳（ISO），用于字段级 LWW
  const nowIso = new Date().toISOString();
  const field_timestamps = {};
  try {
    const keys = Object.keys(payload || {});
    for (const k of keys) {
      field_timestamps[k] = nowIso;
    }
    if (op === 'delete') {
      field_timestamps['deleted'] = nowIso;
    }
  } catch {}
  const record = {
    client_change_id: uuid(),
    resource_type: resourceType,
    op,
    resource_id: resourceId ?? null,
    payload: payload ?? {},
    client_ts: Date.now(),
    base_server_ts: baseServerTs,
    synced_at: null,
    field_timestamps,
  };

  if (await hasIdbStore()) {
    // IndexedDB 写入
    return new Promise(async (resolve, reject) => {
      const conn = await db.openDB();
      const tx = conn.transaction('client_changes_local', 'readwrite');
      const store = tx.objectStore('client_changes_local');
      const req = store.add(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  }
  // localStorage 回退
  try {
    const list = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    list.push(record);
    localStorage.setItem(LS_KEY, JSON.stringify(list));
    return record;
  } catch (e) {
    throw new Error('Failed to persist change locally');
  }
}

/**
 * 获取未同步的变更（最多 limit 条）
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
export async function getPendingChanges(limit = 50) {
  if (await hasIdbStore()) {
    return new Promise(async (resolve, reject) => {
      const conn = await db.openDB();
      const tx = conn.transaction('client_changes_local', 'readonly');
      const store = tx.objectStore('client_changes_local');
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result || []).filter(r => !r.synced_at);
        resolve(all.slice(0, limit));
      };
      req.onerror = () => reject(req.error);
    });
  }
  try {
    const list = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    return list.filter(r => !r.synced_at).slice(0, limit);
  } catch { return []; }
}

/**
 * 标记某条变更为已同步（记录时间）
 * @param {string} client_change_id
 */
export async function markSynced(client_change_id) {
  const now = Date.now();
  if (await hasIdbStore()) {
    return new Promise(async (resolve, reject) => {
      const conn = await db.openDB();
      const tx = conn.transaction('client_changes_local', 'readwrite');
      const store = tx.objectStore('client_changes_local');
      const getReq = store.get(client_change_id);
      getReq.onsuccess = () => {
        const rec = getReq.result;
        if (!rec) return resolve(false);
        rec.synced_at = now;
        const putReq = store.put(rec);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }
  try {
    const list = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    const idx = list.findIndex(r => r.client_change_id === client_change_id);
    if (idx >= 0) list[idx].synced_at = now;
    localStorage.setItem(LS_KEY, JSON.stringify(list));
    return true;
  } catch { return false; }
}

/**
 * 删除某条变更（用于客户端确认后清理）
 * @param {string} client_change_id
 */
export async function removeChange(client_change_id) {
  if (await hasIdbStore()) {
    return new Promise(async (resolve, reject) => {
      const conn = await db.openDB();
      const tx = conn.transaction('client_changes_local', 'readwrite');
      const store = tx.objectStore('client_changes_local');
      const req = store.delete(client_change_id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
  try {
    const list = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    const filtered = list.filter(r => r.client_change_id !== client_change_id);
    localStorage.setItem(LS_KEY, JSON.stringify(filtered));
    return true;
  } catch { return false; }
}

export default { addChange, getPendingChanges, markSynced, removeChange };
