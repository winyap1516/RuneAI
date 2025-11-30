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
  // Migration
  // =========================
  migrateToIdBased() {
    // 1. Migrate Links to ID-first
    const links = this.getLinks();
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
      this.saveLinks(links);
      console.log('Migration: Links updated with IDs');
    }

    // 2. Migrate Subscriptions to use linkId
    const subs = this.getSubscriptions();
    let subsChanged = false;

    subs.forEach(sub => {
      if (!sub.linkId) {
        // Try to find matching link
        const linkId = linkMap.get(normalizeUrl(sub.url)) || linkMap.get(sub.url);
        if (linkId) {
          sub.linkId = linkId;
          subsChanged = true;
        } else {
          // Orphan subscription, keep as is but flag it?
          // User requirement says: "store subscription { linkId, frequency, ... }"
          // If no link, we can't store linkId. We leave it null.
        }
      }
    });

    if (subsChanged) {
      this.saveSubscriptions(subs);
      console.log('Migration: Subscriptions updated with linkIds');
    }
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
      previousUrls: [],
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

    const existing = links[idx];
    const updated = { ...existing, ...patch, updated_at: Date.now() };

    // Handle URL change logic (P1 requirement)
    if (patch.url && patch.url !== existing.url) {
        if (!updated.previousUrls) updated.previousUrls = [];
        // Avoid duplicates in history
        if (!updated.previousUrls.includes(existing.url)) {
            updated.previousUrls.push(existing.url);
        }
    }

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
    // Now based on ID logic, but user said:
    // "delete/unsubscribe operate on link.id"
    // We assume explicit unsubscribe is required by UI, but if link is gone,
    // the subscription becomes an orphan.
    // The UI handles the choice.
    
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
    if (!link) throw new Error('Link not found');

    const subs = this.getSubscriptions();
    
    // Find by linkId first
    let sub = subs.find(s => s.linkId === linkId);
    
    // Fallback: check by URL if migration missed something or dual state
    if (!sub && link.url) {
        const nUrl = normalizeUrl(link.url);
        sub = subs.find(s => !s.linkId && normalizeUrl(s.url) === nUrl);
        if (sub) {
            // Fix it now
            sub.linkId = linkId;
        }
    }

    if (sub) {
      // 已存在，启用
      sub.enabled = true;
      sub.title = link.title || sub.title; // 更新标题
      sub.url = link.url; // Update URL in case it changed
    } else {
      // 不存在，创建
      sub = {
        id: generateId(),
        linkId: link.id,
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
    const subs = this.getSubscriptions();
    const sub = subs.find(s => s.linkId === linkId);

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

  // 彻底删除订阅 (ID based)
  deleteSubscription(subId) {
    const subs = this.getSubscriptions();
    const newSubs = subs.filter(s => s.id !== subId);
    if (newSubs.length !== subs.length) {
        this.saveSubscriptions(newSubs);
    }
  },
  
  // Deprecated but kept for compatibility if needed, now redirects to ID logic if possible
  deleteSubscriptionByUrl(url) {
      // Legacy support or orphan cleanup
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
    // P0: Digest generated successfully behavior
    // If digest has an ID, we assume it's ready.
    // The new requirement says: { id, type: 'single', siteIds: [link.id], summaries: {...}, createdAt }
    
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
  isSubscribed(identifier) {
    // Identifier can be linkId (preferred) or url (legacy fallback)
    const subs = this.getSubscriptions();
    
    // Check by ID
    if (subs.some(s => s.enabled !== false && s.linkId === identifier)) return true;
    
    // Check by URL (Legacy)
    const nUrl = normalizeUrl(identifier);
    if (nUrl) {
        return subs.some(s => s.enabled !== false && normalizeUrl(s.url) === nUrl);
    }
    
    return false;
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
