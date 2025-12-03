// 中文注释：同步代理（Sync Agent）
// 作用：批量推送本地变更到云端（/sync/push），并定期拉取云端增量（/sync/pull）
// 特性：支持离线自动重试、指数退避、批量上限 50、幂等（由服务端按 client_change_id 去重）

import { getPendingChanges, markSynced } from './changeLog.js';
import { setMapping } from './idMapping.js';
import { callFunction } from '../services/supabaseClient.js';
import { showToast } from '../utils/ui-helpers.js';
import db from '../storage/db.js';
import { logger } from '../services/logger.js';
import { config } from '../services/config.js';
import { showConflictModal } from '../components/modal-conflict.js';

// 指数退避序列（毫秒）
const BACKOFF_STEPS = [2000, 4000, 8000, 16000, 30000];
const BATCH_LIMIT = 50;

let running = false;
let backoffIdx = 0;
let timer = null;

/**
 * 执行一次 push（上传本地变更）
 */
async function pushOnce() {
  const changes = await getPendingChanges(BATCH_LIMIT);
  if (!changes || changes.length === 0) return true; // 无变更则视为成功

  // 中文注释：保证每条变更包含字段级时间戳（field_timestamps）
  const enriched = changes.map(ch => ({
    ...ch,
    field_timestamps: ch.field_timestamps || {},
  }));

  const res = await callFunction('sync-push', {
    method: 'POST',
    body: JSON.stringify({ changes: enriched }),
  });
  if (!res.ok) throw new Error(`sync-push failed: ${res.status}`);
  const data = await res.json();

  // 处理成功的 applied
  const applied = Array.isArray(data.applied) ? data.applied : [];
  for (const a of applied) {
    // a.client_change_id 基于服务端返回；标记为已同步
    if (a && a.client_change_id) await markSynced(a.client_change_id);
    // 映射：如返回 server_id 与 local_id，则写入映射
    if (a && a.server_id && a.local_id) {
      // 简化：网站映射；后续可根据资源类型扩展
      try { setMapping('website', a.local_id, a.server_id); } catch {}
    }

    // 中文注释：写入合并后的记录到本地（若服务端返回 merged_record）
    if (a && a.merged_record) {
      await applyMergedRecordLocally(a.merged_record);
    }
  }

  // 非阻断通知：若服务端记录了冲突备份数量，则提示用户
  // UI 冲突处理（若返回 conflicts 并启用 UI）
  const conflicts = Array.isArray(data.conflicts) ? data.conflicts : [];
  if (conflicts.length > 0 && config.uiConflictEnabled) {
    logger.warn('[Sync] 检测到冲突，进入 UI 选择流程', conflicts.length);
    const c = conflicts[0];
    const choice = await showConflictModal({ local: c?.local_snapshot, server: c?.server_snapshot });
    if (choice === 'keepLocal') {
      showToast('已选择保留本地版本，队列继续', 'info');
    } else if (choice === 'useServer') {
      if (c?.server_snapshot) await applyMergedRecordLocally({ resource_type: 'website', data: c.server_snapshot.data, deleted: c.server_snapshot.deleted });
      showToast('已选择使用服务器版本', 'success');
    } else {
      showToast('已取消处理，稍后重试', 'warn');
    }
  }
  const conflictsLogged = Number(data.conflicts_logged || 0);
  if (conflictsLogged > 0) {
    showToast(`部分字段在服务器已更新，已自动合并并保存历史（${conflictsLogged}）`, 'info');
  }
  return true;
}

/**
 * 执行一次 pull（拉取云端变更）
 * 简化版：仅拉取并更新时间戳，暂不执行本地深度合并（避免死循环与冲突风险）
 * 完整合并逻辑将在 Phase 5 中完善
 */
async function pullChanges() {
  try {
    const lastPullTs = localStorage.getItem('rune_last_pull_ts') || new Date(0).toISOString();
    const res = await callFunction(`sync-pull?since=${lastPullTs}`, { method: 'GET' });
    if (!res.ok) return;
    
    const data = await res.json();
    // data: { websites, subscriptions, digests, generation_logs }
    
    // 记录本次 Pull 时间
    localStorage.setItem('rune_last_pull_ts', new Date().toISOString());
    
    // 日志记录（标示 Pull 成功）
    const count = (data.websites?.length || 0) + (data.subscriptions?.length || 0);
    if (count > 0) {
      logger.info('[Sync] Pulled changes (pending application):', count);
    }
  } catch (e) {
    logger.warn('[Sync] Pull failed', e);
  }
}

/**
 * 同步循环：push → 等待 → pull（后续可扩展）
 */
async function loop() {
  if (!running) return;
  try {
    await pushOnce();
    await pullChanges();
    // 成功后重置退避
    backoffIdx = 0;
    scheduleNext(10000); // 正常间隔 10s
  } catch (e) {
    logger.warn('[Sync] Push failed', e.message);
    // 失败后按指数退避
    backoffIdx = Math.min(backoffIdx + 1, BACKOFF_STEPS.length - 1);
    scheduleNext(BACKOFF_STEPS[backoffIdx]);
  }
}

function scheduleNext(ms) {
  clearTimeout(timer);
  timer = setTimeout(loop, ms);
}

/**
 * 将 merged_record 写入本地 IndexedDB（简化映射）
 * @param {object} rec 合并后的记录：{ resource_type, item_id, data, deleted }
 */
async function applyMergedRecordLocally(rec = {}) {
  try {
    const type = rec.resource_type || 'website';
    if (type === 'website') {
      // 简化：将 data 映射至 websites 表的基础字段
      const payload = rec.data || {};
      // 查找是否已存在（按 URL + 用户）
      const url = payload.url || '';
      const userId = 'local-dev';
      const existed = await db.websites.getByUrl(url, userId);
      if (existed) {
        await db.websites.update(existed.website_id, {
          title: payload.title ?? existed.title,
          description: payload.description ?? existed.description,
          category: payload.category ?? existed.category,
          tags: payload.tags ?? existed.tags,
          updated_at: new Date().toISOString()
        });
      } else if (url) {
        await db.websites.create({
          user_id: userId,
          url,
          title: payload.title || url,
          description: payload.description || '',
          category: payload.category || 'All Links',
          tags: Array.isArray(payload.tags) ? payload.tags : []
        });
      }
      // Tombstone：若为删除则本地删除或标记（此处简化为直接删除）
      if (rec.deleted === true) {
        const ex2 = await db.websites.getByUrl(url, userId);
        if (ex2) {
          await db.websites.delete(ex2.website_id);
        }
      }
    }
    // 其它类型（subscription/digest）可按需扩展
  } catch (e) {
    console.warn('[Sync] applyMergedRecordLocally failed', e);
  }
}

// 移除别名导出，保留下方正式导出

/**
 * 启动同步循环（在线状态下立即触发，离线恢复后重试）
 */
export function syncLoop() {
  if (running) return;
  running = true;

  // 网络恢复时立即重试
  try { window.addEventListener('online', () => { backoffIdx = 0; loop(); }); } catch {}
  // 立即开始
  loop();
}

/**
 * 停止同步循环
 */
export function stopSync() {
  running = false;
  clearTimeout(timer);
}

export default { syncLoop, stopSync };
