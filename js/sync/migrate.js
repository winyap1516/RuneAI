// 中文注释：本地数据迁移（IndexedDB → 云端）
// 作用：扫描本地可见数据并生成 create 变更，触发同步上报；可重复执行（幂等依赖服务端去重）

import { websites as Websites, subscriptions as Subs, digests as Digests } from '../storage/db.js';
import { addChange } from './changeLog.js';
import { syncLoop } from './syncAgent.js';

/**
 * 迁移本地数据至云端（create 为主）
 */
export async function migrateLocalToCloud() {
  // Websites
  const sites = await Websites.getAll().catch(() => []);
  for (const w of sites) {
    await addChange('website', 'create', w.website_id, {
      url: w.url,
      title: w.title,
      description: w.description || '',
      category: w.category || null,
      created_at: w.created_at,
    });
  }

  // Subscriptions
  const subs = await Subs.getAll().catch(() => []);
  for (const s of subs) {
    await addChange('subscription', 'create', s.subscription_id, {
      website_id: s.website_id,
      url: s.url,
      title: s.title,
      frequency: s.frequency || 'daily',
      enabled: s.enabled !== false,
      created_at: s.created_at,
    });
  }

  // Digests（分页拉取一次，示例取前 100）
  const { items: digestsPage } = await Digests.getPage(undefined, { offset: 0, limit: 100 }).catch(() => ({ items: [] }));
  for (const d of digestsPage) {
    await addChange('digest', 'create', d.digest_id, {
      website_id: d.website_id,
      summary: d.summary,
      type: d.type,
      created_at: d.created_at,
    });
  }

  // 启动同步循环（若未启动）
  try { syncLoop(); } catch {}
}

export default { migrateLocalToCloud };

