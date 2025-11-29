// Storage Adapter Module
// 封装所有 localStorage 操作，未来可扩展至 Supabase
// 遵循单例模式导出

const KEYS = {
  LINKS: 'rune_cards',
  SUBS: 'rune_subscriptions',
  DIGESTS: 'rune_digests',
  CATEGORIES: 'rune_categories'
};

// 内部辅助：安全读写
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

// 辅助：URL 规范化（用于去重对比）
function normalizeUrl(raw = '') {
  const s = String(raw).trim();
  if (!s) return '';
  const guess = /^(https?:)?\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(guess);
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return '';
  }
}

function normalizeForCompare(raw = '') {
  const n = normalizeUrl(raw);
  if (!n) return '';
  try {
    const u = new URL(n);
    const path = String(u.pathname || '').replace(/\/+$/, '');
    return `${u.hostname.toLowerCase()}${path}`;
  } catch {
    return String(n).toLowerCase().replace(/\/+$/, '');
  }
}

export const storageAdapter = {
  // =========================
  // Links (Cards) Operations
  // =========================

  getLinks() {
    return safeLoad(KEYS.LINKS, []);
  },

  saveLinks(list) {
    safeSave(KEYS.LINKS, list);
  },

  addLink(link) {
    const links = this.getLinks();
    // 简单的查重（按 URL）
    const nUrl = normalizeForCompare(link.url);
    if (nUrl && links.some(l => normalizeForCompare(l.url) === nUrl)) {
      throw new Error('Link already exists');
    }
    
    const newLink = {
      id: link.id || generateId(),
      created_at: Date.now(),
      ...link
    };
    links.unshift(newLink); // 新增在头部
    this.saveLinks(links);

    // 同时也需要确保 Category 存在
    if (link.category) {
      this.ensureCategory(link.category);
    }

    return newLink;
  },

  updateLink(id, patch) {
    const links = this.getLinks();
    const idx = links.findIndex(l => l.id === id);
    if (idx === -1) return null;

    const updated = { ...links[idx], ...patch, updated_at: Date.now() };
    links[idx] = updated;
    this.saveLinks(links);

    // 如果更新了 category，也确保一下
    if (patch.category) {
      this.ensureCategory(patch.category);
    }
    // 如果更新了 URL，可能需要同步更新 Subscription? 
    // 目前暂不处理 URL 变更导致的 Subscription 失效问题，假设 URL 不常变或由用户手动管理

    return updated;
  },

  deleteLink(id) {
    const links = this.getLinks();
    const target = links.find(l => l.id === id);
    if (!target) return false;

    // 1. 删除 Link
    const newLinks = links.filter(l => l.id !== id);
    this.saveLinks(newLinks);

    // 2. 删除关联 Subscription (如果有)
    // 需要通过 URL 匹配
    if (target.url) {
      this.deleteSubscriptionByUrl(target.url);
    }

    return true;
  },

  // =========================
  // Subscriptions Operations
  // =========================

  getSubscriptions() {
    return safeLoad(KEYS.SUBS, []);
  },

  saveSubscriptions(list) {
    safeSave(KEYS.SUBS, list);
  },

  // 根据 Link ID 开启订阅
  subscribe(linkId) {
    const link = this.getLinks().find(l => l.id === linkId);
    if (!link || !link.url) throw new Error('Link not found or invalid URL');

    const subs = this.getSubscriptions();
    const nUrl = normalizeForCompare(link.url);
    
    let sub = subs.find(s => normalizeForCompare(s.url) === nUrl);
    
    if (sub) {
      // 已存在，启用
      sub.enabled = true;
      sub.title = link.title || sub.title; // 更新标题
    } else {
      // 不存在，创建
      sub = {
        id: generateId(),
        url: normalizeUrl(link.url),
        title: link.title || link.url,
        frequency: 'daily',
        enabled: true,
        lastChecked: 0,
        created_at: Date.now()
      };
      subs.push(sub);
    }
    this.saveSubscriptions(subs);
    return sub;
  },

  // 根据 Link ID 取消订阅 (仅 disable，不删除)
  unsubscribe(linkId) {
    const link = this.getLinks().find(l => l.id === linkId);
    if (!link || !link.url) return false;

    const subs = this.getSubscriptions();
    const nUrl = normalizeForCompare(link.url);
    const sub = subs.find(s => normalizeForCompare(s.url) === nUrl);

    if (sub) {
      sub.enabled = false;
      this.saveSubscriptions(subs);
      return true;
    }
    return false;
  },

  // 更新单个订阅 (用于调度器更新状态等)
  updateSubscription(sub) {
    const subs = this.getSubscriptions();
    const idx = subs.findIndex(s => s.id === sub.id);
    if (idx !== -1) {
      subs[idx] = { ...subs[idx], ...sub };
      this.saveSubscriptions(subs);
      return true;
    }
    return false;
  },

  // 彻底删除订阅 (内部使用，配合 deleteLink)
  deleteSubscriptionByUrl(url) {
    const subs = this.getSubscriptions();
    const nUrl = normalizeForCompare(url);
    const leftSubs = subs.filter(s => normalizeForCompare(s.url) !== nUrl);
    
    if (leftSubs.length !== subs.length) {
      this.saveSubscriptions(leftSubs);
      // 同时也清理 Digests
      this.cleanupDigestsByUrl(url);
    }
  },

  // =========================
  // Digests Operations
  // =========================

  getDigests() {
    return safeLoad(KEYS.DIGESTS, []);
  },

  saveDigests(list) {
    safeSave(KEYS.DIGESTS, list);
  },

  addDigest(digest) {
    const digests = this.getDigests();
    // 检查是否是合并 Digest 且当天已存在
    if (digest.merged && digest.date) {
      const existingIdx = digests.findIndex(d => d.merged === true && d.date === digest.date);
      if (existingIdx !== -1) {
        // 合并逻辑通常由调用方处理完 entries 后传入 update，或者在这里做合并
        // 这里假设 addDigest 传入的是一个新的或者完整的 digest 对象
        // 如果业务逻辑是“追加”，建议使用 updateDigest 或专门的 addEntryToDailyDigest
        // 简单起见，这里如果是 ID 冲突则覆盖，否则新增
        digests[existingIdx] = { ...digests[existingIdx], ...digest, entries: digest.entries }; 
        // 注意：这里覆盖可能不安全，但根据目前逻辑，生成器是先读再写的。
        // 更稳妥的方式是直接 push，但 merged digest 要求唯一。
        // 修正：如果已存在，应该更新。
      } else {
        digests.push(digest);
      }
    } else {
      digests.push(digest);
    }
    this.saveDigests(digests);
    return digest;
  },

  // 内部：清理关联 Digest Entries
  cleanupDigestsByUrl(url) {
    const digests = this.getDigests();
    const nUrl = normalizeForCompare(url);
    
    const cleanedDigests = digests.map(d => {
      if (!Array.isArray(d.entries)) return d;
      const newEntries = d.entries.filter(e => normalizeForCompare(e.url) !== nUrl);
      if (newEntries.length !== d.entries.length) {
        return { ...d, entries: newEntries, siteCount: newEntries.length };
      }
      return d;
    }).filter(d => {
      // 如果条目为空，且不是手动创建的空壳（通常 Digest 至少有一条），可以删除
      // 这里策略：如果 entries 变空了，就删掉这个 Digest
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
  isSubscribed(linkUrl) {
    const subs = this.getSubscriptions();
    const nUrl = normalizeForCompare(linkUrl);
    return subs.some(s => s.enabled !== false && normalizeForCompare(s.url) === nUrl);
  },

  // =========================
  // User Profile Operations
  // =========================
  getUser() {
    return safeLoad('runeai_user', null);
  },

  saveUser(user) {
    safeSave('runeai_user', user);
  }
};

export default storageAdapter;
