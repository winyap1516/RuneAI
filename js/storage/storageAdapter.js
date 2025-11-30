// Storage Adapter Module
// 封装所有 localStorage 操作，未来可扩展至 Supabase
// 遵循单例模式导出

import { normalizeUrl } from '../utils/url.js';

const KEYS = {
  LINKS: 'rune_cards',
  SUBS: 'rune_subscriptions',
  DIGESTS: 'rune_digests',
  CATEGORIES: 'rune_categories'
};

// Event listeners
const listeners = [];

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
  // Links (Cards) Operations
  // =========================

  getLinks() {
    return safeLoad(KEYS.LINKS, []);
  },

  saveLinks(list) {
    safeSave(KEYS.LINKS, list);
    this.notify({ type: 'links_changed' });
  },

  addLink(link) {
    const links = this.getLinks();
    // 简单的查重（按 URL）
    const nUrl = normalizeUrl(link.url);
    if (nUrl && links.some(l => normalizeUrl(l.url) === nUrl)) {
      throw new Error('Link already exists');
    }
    
    const newLink = {
      id: link.id || generateId(),
      created_at: Date.now(),
      ...link
    };
    links.unshift(newLink); // 新增在头部
    this.saveLinks(links); // triggers notify

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
    this.saveLinks(links); // triggers notify

    // 如果更新了 category，也确保一下
    if (patch.category) {
      this.ensureCategory(patch.category);
    }

    return updated;
  },

  deleteLink(id) {
    const links = this.getLinks();
    const target = links.find(l => l.id === id);
    if (!target) return false;

    // 1. 删除 Link
    const newLinks = links.filter(l => l.id !== id);
    this.saveLinks(newLinks); // triggers notify

    // 2. 删除关联 Subscription (如果有)
    // 需要通过 URL 匹配
    // 注意：这里可能需要通知，但 deleteSubscriptionByUrl 会负责通知
    if (target.url) {
      // 默认行为：删除卡片时不自动删除订阅，除非调用者明确要求
      // 但此处原逻辑是自动删除。根据用户需求：
      // "如果删除卡片也要同时删除对应订阅...或至少弹提醒"
      // 为了保持 API 行为一致，我们这里先保留原逻辑（彻底清理），或者改为保留订阅（孤儿）。
      // 用户需求中提到“建议首发改为手动列出并可一键 Unsubscribe”，暗示孤儿是可以存在的。
      // 但为了保持数据清洁，如果用户是在 Dashboard 点 Delete，通常期望全删。
      // 不过为了安全，我们这里只删卡片。调用者（Dashboard UI）应该负责询问用户并调用 unsubscribe。
      // 修改：不再自动调用 deleteSubscriptionByUrl(target.url);
      // 让 UI 层决定是否调用 unsubscribe。
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
    this.notify({ type: 'subscriptions_changed' });
  },

  // 根据 Link ID 开启订阅
  subscribeToLink(linkId) {
    const link = this.getLinks().find(l => l.id === linkId);
    if (!link || !link.url) throw new Error('Link not found or invalid URL');

    const subs = this.getSubscriptions();
    const nUrl = normalizeUrl(link.url);
    
    let sub = subs.find(s => normalizeUrl(s.url) === nUrl);
    
    if (sub) {
      // 已存在，启用
      sub.enabled = true;
      sub.title = link.title || sub.title; // 更新标题
    } else {
      // 不存在，创建
      sub = {
        id: generateId(),
        url: normalizeUrl(link.url), // Store normalized or raw? Better store raw if available, but for matching we use normalized.
        // Actually, let's store the raw url from link for display, but matching uses normalized.
        // Wait, if we normalize here, we lose the original casing for display.
        // Let's store link.url (raw) but ensure we can match it later.
        url: link.url, 
        title: link.title || link.url,
        frequency: 'daily',
        enabled: true,
        lastChecked: 0,
        created_at: Date.now()
      };
      subs.push(sub);
    }
    this.saveSubscriptions(subs); // triggers notify
    return sub;
  },

  // 根据 Link ID 取消订阅 (仅 disable，不删除)
  unsubscribeFromLink(linkId) {
    const link = this.getLinks().find(l => l.id === linkId);
    if (!link || !link.url) return false;

    const subs = this.getSubscriptions();
    const nUrl = normalizeUrl(link.url);
    const sub = subs.find(s => normalizeUrl(s.url) === nUrl);

    if (sub) {
      sub.enabled = false;
      this.saveSubscriptions(subs); // triggers notify
      return true;
    }
    return false;
  },

  // 更新单个订阅
  updateSubscription(sub) {
    const subs = this.getSubscriptions();
    const idx = subs.findIndex(s => s.id === sub.id);
    if (idx !== -1) {
      subs[idx] = { ...subs[idx], ...sub };
      this.saveSubscriptions(subs); // triggers notify
      return true;
    }
    return false;
  },

  // 彻底删除订阅
  deleteSubscriptionByUrl(url) {
    const subs = this.getSubscriptions();
    const nUrl = normalizeUrl(url);
    const leftSubs = subs.filter(s => normalizeUrl(s.url) !== nUrl);
    
    if (leftSubs.length !== subs.length) {
      this.saveSubscriptions(leftSubs); // triggers notify
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
    // Digest changes might not need global UI refresh immediately, but why not
    this.notify({ type: 'digests_changed' });
  },

  addDigest(digest) {
    const digests = this.getDigests();
    if (digest.merged && digest.date) {
      const existingIdx = digests.findIndex(d => d.merged === true && d.date === digest.date);
      if (existingIdx !== -1) {
        digests[existingIdx] = { ...digests[existingIdx], ...digest, entries: digest.entries }; 
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
  isSubscribed(linkUrl) {
    const subs = this.getSubscriptions();
    const nUrl = normalizeUrl(linkUrl);
    return subs.some(s => s.enabled !== false && normalizeUrl(s.url) === nUrl);
  },

  // =========================
  // User Profile Operations
  // =========================
  getUser() {
    return safeLoad('runeai_user', null);
  },

  saveUser(user) {
    safeSave('runeai_user', user);
    this.notify({ type: 'user_changed' });
  }
};

export default storageAdapter;
