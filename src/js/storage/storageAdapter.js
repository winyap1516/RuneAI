// Storage Adapter Module
// 适配层：将原先的 localStorage 读写改为 IndexedDB（见 js/storage/db.js）
// 设计目标：
// - 保持对外 API 名称与行为最大兼容（getLinks/getSubscriptions/...）
// - 统一为每条记录补齐 user_id（本地开发固定为 local-dev）
// - 保留事件总线与部分 legacy 字段（如 categories、本地审计日志）以减少 UI 改动

import { normalizeUrl } from '/src/js/utils/url.js';
import db, { websites as Websites, subscriptions as Subs, digests as Digests } from './db.js';
// 中文注释：文本处理工具来自旧版 js/services，为保持兼容性在此跨树导入
// 注意：从 src/js/storage 路径回到仓库根后再进入 js/services
// 中文注释：文本处理工具（已迁移到 src/js/services）
import { cleanTextForStorage, enforceFieldLengths, sanitizeText, preprocessText, truncateText } from '/src/js/services/text_service.js';
import { addChange as enqueueChange } from '/src/js/sync/changeLog.js';
import { getServerId } from '/src/js/sync/idMapping.js';

const KEYS = {
  LINKS: 'rune_cards',
  SUBS: 'rune_subscriptions',
  DIGESTS: 'rune_digests',
  CATEGORIES: 'rune_categories',
  GENERATION_HISTORY: 'rune_generation_history'
};

// Event listeners
const listeners = [];

// 内部辅助：安全读写（仅用于保留的 localStorage 数据：categories、generation_history、user）
function safeLoad(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn(`Failed to load ${key}`, e);
    return fallback;
  }
}

function safeSave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save ${key}`, e);
  }
}

// 辅助：生成 ID
function generateId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const storageAdapter = {
  // =========================
  // Event System
  // =========================
  subscribe(listener) {
    if (typeof listener === 'function') {
      listeners.push(listener);
    }
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  },

  notify(event) {
    listeners.forEach(fn => {
      try { fn(event); } catch (e) { console.error('Event listener error:', e); }
    });
  },

  // =========================
  // Migration
  // =========================
  async migrateToIdBased() {
    console.log('[Migration] Checking status...');
    // P0: Migration must run only once
    if (localStorage.getItem('rune_migrated_to_id') === '1') {
        console.log('[Migration] Already migrated. Skipping.');
        return;
    }

    console.log('[Migration] Starting ID-based migration...');
    
    // 1. Migrate Links to ID-first
    const links = await this.getLinks();
    let linksChanged = false;
    const linkMap = new Map();

    links.forEach(link => {
      if (!link.id) {
        link.id = generateId();
        linksChanged = true;
      }
      // Ensure internal fields
      if (!link.previousUrls) link.previousUrls = [];
      
      linkMap.set(normalizeUrl(link.url), link.id);
      // Also map raw url just in case
      if (link.url) linkMap.set(link.url, link.id);
    });

    if (linksChanged) {
      await this.saveLinks(links);
      console.log('[Migration] Links updated with IDs');
    }

    // 2. Migrate Subscriptions to use linkId
    const subs = await this.getSubscriptions();
    let subsChanged = false;
    
    // P0: If subscriptions already exist, do NOT overwrite them if they look migrated
    // But we need to ensure linkId is present.
    
    subs.forEach(sub => {
      if (!sub.linkId) {
        // Try to find matching link
        const linkId = linkMap.get(normalizeUrl(sub.url)) || linkMap.get(sub.url);
        if (linkId) {
          sub.linkId = linkId;
          subsChanged = true;
        }
      }
    });

    if (subsChanged) {
      await this.saveSubscriptions(subs);
      console.log('[Migration] Subscriptions updated with linkIds');
    }
    
    // Mark migration as complete
    localStorage.setItem('rune_migrated_to_id', '1');
    console.log('[Migration] Completed');
  },

  // =========================
  // Migration (localStorage → IndexedDB)
  // =========================
  async migrateLocalStorageToIndexedDB() {
    // 目的：将现有 localStorage 中的 Links/Subscriptions/Digests 迁移至 IndexedDB
    // 触发策略：仅在尚未迁移且 IndexedDB 初始为空时执行一次
    try {
      if (localStorage.getItem('rune_migrated_to_indexeddb') === '1') return
      const dbConn = await db.openDB()
      const hasAnyData = dbConn.objectStoreNames.length > 0
      // 简单判断：如果 websites 存在且非空则认为已初始化
      const existingWebsites = await Websites.getAll().catch(() => [])
      if ((existingWebsites && existingWebsites.length > 0)) {
        localStorage.setItem('rune_migrated_to_indexeddb', '1')
        return
      }

      // 1. 迁移 Links → websites
      const links = safeLoad(KEYS.LINKS, [])
      const urlToWebsiteId = new Map()
      for (const l of links) {
        const rec = await Websites.create({
          url: l.url,
          title: l.title || l.url,
          description: l.description || '',
          category: l.category || null,
          previousUrls: l.previousUrls || [],
          created_at: l.created_at ? new Date(l.created_at).toISOString() : undefined,
          user_id: (this.getUser()?.id) || 'local-dev',
        })
        urlToWebsiteId.set(normalizeUrl(rec.url), rec.website_id)
      }

      // 2. 迁移 Subscriptions → subscriptions
      const subs = safeLoad(KEYS.SUBS, [])
      for (const s of subs) {
        // 优先使用 linkId 映射；否则按 URL 匹配
        let websiteId = s.linkId
        if (!websiteId && s.url) websiteId = urlToWebsiteId.get(normalizeUrl(s.url))
        if (!websiteId) continue
        await Subs.upsert({
          website_id: websiteId,
          url: s.url,
          title: s.title || s.url,
          frequency: s.frequency || 'daily',
          enabled: s.enabled !== false,
          user_id: (this.getUser()?.id) || 'local-dev',
          last_generated_at: s.lastChecked || 0,
        })
      }

      // 3. 迁移 Digests → digests（尽力映射）
      const oldDigests = safeLoad(KEYS.DIGESTS, [])
      for (const d of oldDigests) {
        // 旧结构可能为合并日报：{ merged: true, date, entries: [{ url, summary, ... }] }
        if (d.merged && Array.isArray(d.entries)) {
          for (const e of d.entries) {
            const wid = urlToWebsiteId.get(normalizeUrl(e.url))
            if (!wid) continue
            await Digests.create({
              website_id: wid,
              summary: e.summary || e.description || '',
              type: 'daily',
              created_at: d.date ? new Date(d.date).toISOString() : undefined,
              user_id: (this.getUser()?.id) || 'local-dev',
            })
          }
          continue
        }
        // 非合并：尝试使用 site/link 信息
        const wid = d.linkId ? d.linkId : (d.url ? urlToWebsiteId.get(normalizeUrl(d.url)) : null)
        if (!wid) continue
        await Digests.create({
          website_id: wid,
          summary: d.summary || d.description || '',
          type: (d.type === 'single' || d.type === 'manual') ? 'manual' : 'daily',
          created_at: d.created_at ? new Date(d.created_at).toISOString() : undefined,
          user_id: (this.getUser()?.id) || 'local-dev',
        })
      }

      // 标记迁移完成
      localStorage.setItem('rune_migrated_to_indexeddb', '1')
      this.notify({ type: 'links_changed' })
      this.notify({ type: 'subscriptions_changed' })
      this.notify({ type: 'digests_changed' })
      try { window.dispatchEvent(new CustomEvent('subscriptionsChanged')) } catch(e) {}
      console.log('[Migration] localStorage → IndexedDB completed')
    } catch (err) {
      console.error('[Migration] Failed', err)
    }
  },

  // =========================
  // Generation History & Quota
  // =========================
  getGenerationHistory() {
    return safeLoad(KEYS.GENERATION_HISTORY, []);
  },

  saveGenerationHistory(list) {
    safeSave(KEYS.GENERATION_HISTORY, list);
    this.notify({ type: 'generation_history_changed' });
  },

  addGenerationLog(log) {
    const history = this.getGenerationHistory();
    const entry = {
      id: generateId(),
      timestamp: Date.now(),
      created_at: new Date().toISOString(),
      ...log
    };
    history.push(entry);
    this.saveGenerationHistory(history);
    return entry;
  },

  getDailyUsageCount(userId, type) {
    // Type is optional, if not provided, counts all
    const history = this.getGenerationHistory();
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    return history.filter(entry => {
      // Filter by time (today)
      if (entry.timestamp < startOfDay) return false;
      // Filter by status (only success counts?) Requirement: "生成失败...不计入每日次数" -> "成功要记录审计日志"
      // We assume only success logs are added via addGenerationLog or we filter by status 'success'
      if (entry.status !== 'success') return false;
      // Filter by user (if provided)
      if (userId && entry.userId !== userId) return false;
      // Filter by type (if provided)
      if (type && entry.type !== type) return false;
      
      return true;
    }).length;
  },

  getLastGenerationTime(linkId, type) {
     // For cooldown calculation
     const history = this.getGenerationHistory();
     // Sort desc by timestamp
     const sorted = history.sort((a,b) => b.timestamp - a.timestamp);
     
     // 修复：ID类型兼容处理
     const targetLinkId = linkId ? (typeof linkId === 'string' ? parseInt(linkId, 10) : linkId) : null;

     // Find latest success
     const latest = sorted.find(entry => {
         if (entry.status !== 'success') return false;
         if (type && entry.type !== type) return false;
         if (targetLinkId) {
            const entryLinkId = entry.linkId ? (typeof entry.linkId === 'string' ? parseInt(entry.linkId, 10) : entry.linkId) : null;
            if (entryLinkId !== targetLinkId) return false;
         }
         return true;
     });
     return latest ? latest.timestamp : 0;
  },

  // =========================
  // Links (Cards) Operations → IndexedDB
  // =========================

  /**
   * Get all links for current user
   * @returns {Promise<Array<Object>>} List of link objects
   */
  async getLinks() {
    // 中文注释：按当前用户读取网站列表与订阅列表，避免不同用户数据交叉导致 UI 状态错误
    const userId = (this.getUser()?.id) || 'local-dev';
    const all = await Websites.getAll(userId);
    const subs = await Subs.getAll(userId);
    const subscribedSet = new Set(subs.filter(s => s.enabled !== false).map(s => s.website_id));
    // 兼容 UI：保持 id 字段与 previousUrls
    return all.map(w => ({
      id: w.website_id,
      website_id: w.website_id,
      url: w.url,
      title: w.title,
      description: w.description,
      created_at: w.created_at,
      subscribed: subscribedSet.has(w.website_id),
      previousUrls: w.previousUrls || [],
      category: w.category || null,
    }))
  },

  /**
   * Get paginated links
   * @param {Object} options { limit, offset }
   * @returns {Promise<Object>} { items, total, hasMore }
   */
  async getLinksPage({ limit = 20, offset = 0 } = {}) {
    // 中文注释：分页读取时同样按当前用户过滤订阅集合，保证状态正确
    const userId = (this.getUser()?.id) || 'local-dev';
    const { items, total, hasMore } = await Websites.getPage(userId, { limit, offset });
    
    // 需要附加订阅状态（当前用户）
    const subs = await Subs.getAll(userId);
    const subscribedSet = new Set(subs.filter(s => s.enabled !== false).map(s => s.website_id));

    const mappedItems = items.map(w => ({
      id: w.website_id,
      website_id: w.website_id,
      url: w.url,
      title: w.title,
      description: w.description,
      created_at: w.created_at,
      subscribed: subscribedSet.has(w.website_id),
      previousUrls: w.previousUrls || [],
      category: w.category || null,
    }));

    return { items: mappedItems, total, hasMore };
  },

  /**
   * Add a new link
   * @param {Object} link Link data
   * @param {Object} options
   * @returns {Promise<Object>} Created link
   */
  async addLink(link, options = {}) {
    // 简单查重：url+user 唯一
    const existed = await Websites.getByUrl(link.url)
    if (existed) throw new Error('Link already exists')
    // 文本字段预处理与长度限制
    const limited = enforceFieldLengths({
      title: link.title || link.url,
      description: link.description || '',
    })
    const record = await Websites.create({
      url: link.url,
      title: cleanTextForStorage(limited.title, 200),
      description: cleanTextForStorage(limited.description, 2000),
      category: link.category || null,
      user_id: (this.getUser()?.id) || 'local-dev',
    })
    // 写入本地变更日志（create）
    try { await enqueueChange('website', 'create', record.website_id, { url: record.url, title: record.title, description: record.description, category: record.category }) } catch {}
    // 分类维护
    if (record.category) this.ensureCategory(record.category)
    if (!options.silent) this.notify({ type: 'links_changed' })
    return {
      id: record.website_id,
      website_id: record.website_id,
      ...record
    }
  },

  /**
   * Update a link
   * @param {number} id Website ID
   * @param {Object} patch Data to update
   * @param {Object} options
   * @returns {Promise<Object|null>} Updated link
   */
  async updateLink(id, patch, options = {}) {
    const existing = await Websites.getById(id)
    if (!existing) return null
    // 字段清洗与长度限制
    const limitedPatch = enforceFieldLengths({
      title: patch?.title,
      description: patch?.description,
    })
    const updated = await Websites.update(id, {
      ...patch,
      title: limitedPatch.title != null ? cleanTextForStorage(limitedPatch.title, 200) : existing.title,
      description: limitedPatch.description != null ? cleanTextForStorage(limitedPatch.description, 2000) : existing.description,
      // 维护 URL 变更历史（previousUrls）
      previousUrls: (() => {
        const prev = existing.previousUrls || []
        if (patch.url && patch.url !== existing.url) {
          if (!prev.includes(existing.url)) prev.push(existing.url)
        }
        return prev
      })()
    })
    // 写入本地变更日志（update），优先使用服务器 UUID 作为 resource_id
    const serverId = getServerId('website', id) || id;
    const baseTs = existing.updated_at || null;
    try { await enqueueChange('website', 'update', serverId, patch, baseTs) } catch {}
    if (patch.category) this.ensureCategory(patch.category)
    if (!options.silent) this.notify({ type: 'links_changed' })
    return { id, website_id: id, ...updated }
  },

  /**
   * Delete a link
   * @param {number} id Website ID
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  async deleteLink(id, options = {}) {
    // 删除网站并级联清理订阅与摘要
    await Websites.delete(id)
    await Subs.deleteByWebsite(id)
    await Digests.deleteByWebsite(id)
    // 写入本地变更日志（delete），优先使用服务器 UUID
    const serverId = getServerId('website', id) || id;
    try { await enqueueChange('website', 'delete', serverId, {}) } catch {}
    if (!options.silent) {
      this.notify({ type: 'links_changed' })
      this.notify({ type: 'subscriptions_changed' })
      this.notify({ type: 'digests_changed' })
      try { window.dispatchEvent(new CustomEvent('subscriptionsChanged')) } catch(e) {}
    }
    return true
  },

  // =========================
  // Subscriptions Operations
  // =========================

  async getSubscriptions() {
    // 中文注释：按当前用户读取订阅列表，并返回扩展字段（channel/target_id/consent_time/frequency）
    const userId = (this.getUser()?.id) || 'local-dev';
    const list = await Subs.getAll(userId)
    return list.map(s => ({
      id: s.subscription_id,
      subscription_id: s.subscription_id,
      linkId: s.website_id,
      website_id: s.website_id,
      url: s.url,
      title: s.title,
      frequency: s.frequency || 'daily',
      enabled: s.enabled !== false,
      channel: s.channel || 'none',
      target_id: s.target_id || '',
      consent_time: s.consent_time || null,
      last_generated_at: s.last_generated_at || 0,
      created_at: s.created_at,
    }))
  },

  saveSubscriptions(list) {
    // 兼容旧调用：不再直接写 localStorage，仅触发通知
    this.notify({ type: 'subscriptions_changed' })
  },

  // 根据 Link ID 开启订阅
  async subscribeToLink(linkId, options = {}) {
    console.log('[Storage] subscribeToLink start', linkId);
    // 修复：将字符串linkId转换为数字类型，与数据库中的website_id匹配
    const numericLinkId = typeof linkId === 'string' ? parseInt(linkId, 10) : linkId;
    
    const link = await Websites.getById(numericLinkId)
    if (!link) {
      console.error('[Storage] Link not found for ID:', numericLinkId, '(original:', linkId, ')');
      throw new Error(`Link not found for ID: ${linkId}`)
    }
    
    const sub = await Subs.upsert({
      website_id: numericLinkId,
      url: link.url,
      title: link.title || link.url,
      frequency: 'daily',
      enabled: true,
      channel: (safeLoad('rune_subscription_settings', { channel: 'none' }).channel || 'none'),
      target_id: (safeLoad('rune_subscription_settings', { target_id: '' }).target_id || ''),
      consent_time: new Date().toISOString(),
      user_id: (this.getUser()?.id) || 'local-dev',
    })
    // 写入本地变更日志（create subscription）
    try { await enqueueChange('subscription', 'create', sub.subscription_id, { website_id: getServerId('website', numericLinkId) || null, url: sub.url, title: sub.title, frequency: sub.frequency, enabled: true }) } catch {}
    if (!options.silent) {
      this.notify({ type: 'subscriptions_changed' })
      try { window.dispatchEvent(new CustomEvent('subscriptionsChanged')) } catch(e) {}
    }
    return {
      id: sub.subscription_id,
      linkId: sub.website_id,
      url: sub.url,
      title: sub.title,
      frequency: sub.frequency,
      enabled: sub.enabled !== false,
      created_at: sub.created_at,
    }
  },

  // 根据 Link ID 取消订阅 (仅 disable，不删除)
  async unsubscribeFromLink(linkId, options = {}) {
    console.log('[Storage] unsubscribeFromLink start', linkId);
    // 修复：将字符串linkId转换为数字类型，与数据库中的website_id匹配
    const numericLinkId = typeof linkId === 'string' ? parseInt(linkId, 10) : linkId;
    // 中文注释：软禁用而非删除，保留记录
    await Subs.upsert({ website_id: numericLinkId, enabled: false, user_id: (this.getUser()?.id) || 'local-dev' })
    // 写入本地变更日志（delete subscription）
    const subsList = await Subs.getAll();
    const sub = subsList.find(s => s.website_id === numericLinkId);
    if (sub) {
      const serverSubId = getServerId('subscription', sub.subscription_id) || sub.subscription_id;
      try { await enqueueChange('subscription', 'delete', serverSubId, {}) } catch {}
    }
    if (!options.silent) {
      this.notify({ type: 'subscriptions_changed' });
      try { window.dispatchEvent(new CustomEvent('subscriptionsChanged')) } catch(e) {}
    }
    return true
  },

  // =========================
  // Global Subscription Settings
  // =========================
  async setGlobalSubscriptionSettings({ enabled, frequency, channel, target_id }) {
    const userId = (this.getUser()?.id) || 'local-dev';
    const links = await Websites.getAll(userId);
    // 先保存全局设置到 localStorage，供订阅创建时读取
    safeSave('rune_subscription_settings', {
      channel: channel || 'none',
      target_id: target_id || '',
      frequency: frequency || (enabled ? 'daily' : 'off'),
      updated_at: new Date().toISOString()
    });
    for (const w of links) {
      await Subs.upsert({
        website_id: w.website_id,
        url: w.url,
        title: w.title || w.url,
        frequency: (frequency || (enabled ? 'daily' : 'off')),
        enabled: enabled === true,
        channel: channel || 'none',
        target_id: target_id || '',
        consent_time: enabled ? new Date().toISOString() : null,
        user_id: userId
      });
    }
    this.notify({ type: 'subscriptions_changed' });
    try { window.dispatchEvent(new CustomEvent('subscriptionsChanged')) } catch(e) {}
  },
  getGlobalSubscriptionStatus() {
    const s = safeLoad('rune_subscription_settings', null);
    if (!s) return { enabled: false, frequency: 'off', channel: 'none', target_id: '' };
    const enabled = s.frequency && s.frequency !== 'off';
    return { enabled, frequency: s.frequency || 'off', channel: s.channel || 'none', target_id: s.target_id || '' };
  },

  // 更新单个订阅
  async updateSubscription(sub, options = {}) {
    // 兼容旧行为：按 subscription_id 更新，若仅需要禁用则写入 enabled=false
    const currentList = await this.getSubscriptions()
    const current = currentList.find(s => s.id === sub.id || s.subscription_id === sub.id)
    if (!current) return false
    await Subs.upsert({
      subscription_id: current.subscription_id,
      website_id: current.linkId,
      url: sub.url ?? current.url,
      title: sub.title ?? current.title,
      frequency: sub.frequency ?? current.frequency,
      enabled: sub.enabled ?? current.enabled,
      user_id: (this.getUser()?.id) || 'local-dev',
    })
    if (!options.silent) this.notify({ type: 'subscriptions_changed' })
    return true
  },

  // 彻底删除订阅 (ID based)
  async deleteSubscription(subId) {
    // 通过读取找到主键后删除
    const list = await this.getSubscriptions()
    const target = list.find(s => s.id === subId || s.subscription_id === subId)
    if (!target) return false
    await Subs.delete(target.subscription_id)
    this.notify({ type: 'subscriptions_changed' })
    return true
  },
  
  // Deprecated but kept for compatibility if needed, now redirects to ID logic if possible
  async deleteSubscriptionByUrl(url) {
    // 兼容旧逻辑：按 URL 清理订阅，并清理摘要
    const list = await this.getSubscriptions()
    const nUrl = normalizeUrl(url)
    const target = list.find(s => normalizeUrl(s.url) === nUrl)
    if (target) {
      await Subs.delete(target.subscription_id)
      await this.cleanupDigestsByUrl(url)
      this.notify({ type: 'subscriptions_changed' })
    }
  },

  // =========================
  // Digests Operations
  // =========================

  // =========================
  // Digests Operations → IndexedDB（新规范）
  // =========================
  async getDigests() {
    // 注意：与旧结构不同（旧结构支持 merged 的日报卡片），
    // 新规范直接返回每条摘要记录，UI 层负责按需要分组/统计
    const links = await this.getLinks()
    const allByLink = await Promise.all(links.map(l => Digests.getByWebsite(l.website_id)))
    return allByLink.flat()
  },

  // 分页获取 Digests
  async getDigestsPage({ limit = 20, offset = 0 } = {}) {
    const userId = (this.getUser()?.id) || 'local-dev';
    return await Digests.getPage(userId, { limit, offset });
  },

  async saveDigests(list) {
    // 兼容旧方法签名：批量写入不再支持，保留通知以避免 UI 崩溃
    this.notify({ type: 'digests_changed' })
  },

  async addDigest(digest) {
    // digest: { website_id, summary, type, content? }
    // 中文注释：兼容旧调用（可能未设置 type），默认按每日摘要写入；并限制摘要长度避免存储过大。
    const limited = enforceFieldLengths({ summary: digest.summary })
    const type = digest.type || 'daily'
    const record = await Digests.create({
      website_id: digest.website_id,
      summary: cleanTextForStorage(limited.summary, 300),
      type,
      user_id: (this.getUser()?.id) || 'local-dev',
    })
    // 可选：长文本入分表（digest_contents）
    if (digest.content) {
      const userId = (this.getUser()?.id) || 'local-dev';
      const contentClean = cleanTextForStorage(digest.content, 20000)
      const summaryClean = cleanTextForStorage(digest.summary || digest.content.slice(0, 300), 300)
      try { await db.digestContents.upsert({ digest_id: record.digest_id, user_id: userId, content: contentClean, summary: summaryClean }) } catch {}
    }
    this.notify({ type: 'digests_changed' })
    return record
  },

  // 内部：清理关联 Digest Entries
  cleanupDigestsByUrl(url) {
    const digests = this.getDigests();
    const nUrl = normalizeUrl(url);
    
    const cleanedDigests = digests.map(d => {
      if (!Array.isArray(d.entries)) return d;
      const newEntries = d.entries.filter(e => normalizeUrl(e.url) !== nUrl);
      if (newEntries.length !== d.entries.length) {
        return { ...d, entries: newEntries, siteCount: newEntries.length };
      }
      return d;
    }).filter(d => {
      return Array.isArray(d.entries) && d.entries.length > 0;
    });

    this.saveDigests(cleanedDigests);
  },

  // =========================
  // Categories Operations
  // =========================
  getCategories() {
    return safeLoad(KEYS.CATEGORIES, []);
  },
  
  saveCategories(list) {
    safeSave(KEYS.CATEGORIES, list);
    this.notify({ type: 'categories_changed' });
  },

  ensureCategory(name) {
    const cat = String(name || '').trim();
    if (!cat || cat === 'All Links') return;
    
    const list = this.getCategories();
    if (!list.includes(cat)) {
      list.push(cat);
      this.saveCategories(list);
    }
  },
  
  deleteCategory(name) {
    const list = this.getCategories();
    const newList = list.filter(c => c !== name);
    this.saveCategories(newList);
  },
  
  // =========================
  // Helper for Subscription Status
  // =========================
  async isSubscribed(identifier) {
    // 兼容：identifier 可为 linkId 或原始 URL
    const subs = await this.getSubscriptions()
    // by ID
    if (subs.some(s => s.enabled !== false && s.linkId === identifier)) return true
    // by URL
    const nUrl = normalizeUrl(identifier)
    if (nUrl) return subs.some(s => s.enabled !== false && normalizeUrl(s.url) === nUrl)
    return false
  },

  // =========================
  // User Profile Operations
  // =========================
  /**
   * Get current user
   * @returns {Object|null}
   */
  getUser() {
    return safeLoad('runeai_user', null);
  },

  /**
   * Save user profile
   * @param {Object} user
   */
  saveUser(user) {
    // 保护用户对象中的可疑文本字段（若存在）
    const u = { ...user };
    if (u.name != null) u.name = cleanTextForStorage(enforceFieldLengths({ title: u.name }).title, 200);
    safeSave('runeai_user', u);
    this.notify({ type: 'user_changed' });
  }
};

// 扩展：网站长文本保存（供控制器调用）
export async function saveWebsiteContent(websiteId, { content, summary }) {
  try {
    const userId = (storageAdapter.getUser()?.id) || 'local-dev';
    const contentClean = cleanTextForStorage(content, 20000);
    const summaryClean = cleanTextForStorage(summary ?? contentClean.slice(0, 300), 300);
    return await db.websiteContents.upsert({ website_id: websiteId, user_id: userId, content: contentClean, summary: summaryClean });
  } catch (e) {
    console.warn('[Storage] saveWebsiteContent failed', e);
    return null;
  }
}

export default storageAdapter;

// 启动时尝试执行一次迁移（仅首次）
try {
  storageAdapter.migrateLocalStorageToIndexedDB()
} catch (e) {
  console.warn('[Startup] migrateLocalStorageToIndexedDB skipped', e)
}
