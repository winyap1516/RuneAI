// 中文注释：前端 Mock 服务（脱离 Supabase 的开发/测试模式）
// 作用：提供与后端等价的接口层（getCards/getCategories/CRUD/订阅/生成 Digest），并在需要时加载静态 JSON 作为数据源。
// 说明：
// - 数据来源：public/mock/mock_bundle_v1 下的 JSON（通过 Vite 的 public 目录静态托管）
// - 存储后端：复用现有 storageAdapter（IndexedDB/LocalStorage 封装），以便 UI 与分页逻辑无缝工作
// - 延迟与失败：所有接口模拟 100–400ms 延迟，并支持 10% 失败注入（可通过 window.__MOCK_FAIL_RATE 配置）

import logger from '/src/js/services/logger.js';
import storageAdapter from '/src/js/storage/storageAdapter.js';

const BUNDLE_BASE = '/mock/mock_bundle_v1';
const FAIL_RATE = () => {
  const v = typeof window !== 'undefined' ? Number(window.__MOCK_FAIL_RATE || 0.1) : 0.1;
  return Math.max(0, Math.min(1, v));
};

function delay(ms = 200) { return new Promise(r => setTimeout(r, ms)); }
function randDelay() { return delay(100 + Math.floor(Math.random() * 300)); }
function shouldFail() { return Math.random() < FAIL_RATE(); }

async function fetchJSON(path) {
  const url = `${BUNDLE_BASE}/${path}`;
  logger.info('[MockService] 加载 JSON：', url);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP_${resp.status}`);
  return await resp.json();
}

function buildCategoryMap(categories) {
  const id2name = new Map();
  for (const c of categories) { id2name.set(c.id, c.name); }
  return id2name;
}

function normalizeCardToLink(card, id2name) {
  // 中文注释：将 Mock Card Schema 映射到现有 Links 视图所需的结构
  const firstCatId = Array.isArray(card.category_ids) && card.category_ids.length ? card.category_ids[0] : null;
  const categoryName = firstCatId && id2name.has(firstCatId) ? id2name.get(firstCatId) : 'All Links';
  const desc = String(card.content_preview || '').slice(0, 300) || 'AI summary (mock)';
  return {
    id: card.id,
    title: card.title || 'Untitled',
    description: desc,
    category: categoryName,
    tags: Array.isArray(card.tags) ? card.tags : [],
    url: `https://example.com/mock/${card.id}`,
    created_at: card.created_at,
    updated_at: card.updated_at
  };
}

export const mockService = {
  // 中文注释：一次性加载 Bundle 到本地存储，便于页面初始化直接渲染
  async loadBundle() {
    logger.info('[MockService] Mock mode enabled');
    logger.info('[MockService] Supabase initialization skipped');
    await randDelay();
    const categories = await fetchJSON('mock_categories.json');
    const cards = await fetchJSON('mock_cards.json');
    const id2name = buildCategoryMap(categories);

    // 写入分类
    for (const c of categories) { try { await storageAdapter.ensureCategory(c.name); } catch {} }

    // 写入卡片（按 Links 结构）
    for (const card of cards) {
      const link = normalizeCardToLink(card, id2name);
      try { await storageAdapter.addLink(link, { silent: true }); } catch {}
    }
    // 触发一次刷新通知
    try { await storageAdapter.notify({ type: 'links_changed' }); } catch {}
    logger.info('[MockService] Bundle loaded (cards/categories)');
  },

  // ===== API 等价接口（供 apiRouter 选择性导出） =====
  async getCards(params = {}) {
    await randDelay();
    if (shouldFail()) throw { code: 'SERVER_TIMEOUT', message: 'Timeout' };
    const categories = await fetchJSON('mock_categories.json');
    const id2name = buildCategoryMap(categories);
    const cards = await fetchJSON('mock_cards.json');
    return cards.map(c => normalizeCardToLink(c, id2name));
  },

  async getCard(id) {
    await randDelay();
    const cards = await fetchJSON('mock_cards.json');
    const categories = await fetchJSON('mock_categories.json');
    const id2name = buildCategoryMap(categories);
    const found = cards.find(c => String(c.id) === String(id));
    if (!found) throw { code: 'NOT_FOUND' };
    return normalizeCardToLink(found, id2name);
  },

  async createCard(payload) {
    await randDelay();
    if (shouldFail()) throw { code: 'INVALID_PAYLOAD' };
    // 写入到本地存储，返回新对象
    const added = await storageAdapter.addLink({
      title: payload.title || 'Untitled',
      description: payload.description || 'Mock created',
      category: payload.category || 'All Links',
      tags: payload.tags || [],
      url: payload.url || `https://example.com/mock/${Date.now()}`
    }, { silent: true });
    return { created_card_id: added.id, card: added };
  },

  async updateCard(id, payload) {
    await randDelay();
    if (shouldFail()) throw { code: 'NETWORK_ERROR' };
    await storageAdapter.updateLink(id, payload, { silent: true });
    return { ok: true };
  },

  async deleteCard(id, opts = {}) {
    await delay(200); // 固定 200ms 延迟
    // 若前端传入 published 状态，返回需要二次确认
    if (opts?.status === 'published') {
      return { requires_confirm_unpublish: true };
    }
    await storageAdapter.deleteLink(id, { silent: true });
    return { ok: true };
  },

  async getCategories() {
    await randDelay();
    const json = await fetchJSON('mock_categories.json');
    return json;
  },

  async createCategory(name) {
    await randDelay();
    if (shouldFail()) throw { code: 'SERVER_ERROR', status: 500 };
    await storageAdapter.ensureCategory(name);
    return { ok: true };
  },

  async subscribe(cardId) {
    await randDelay();
    // 中文注释：模拟订阅，仅做状态写入，不涉及服务端
    await storageAdapter.subscribeToLink(cardId, { silent: true });
    return { success: true, status: 'subscribed' };
  },

  async generateNow(params = {}) {
    await randDelay();
    // 中文注释：生成一条新卡片并返回其 ID
    const link = await storageAdapter.addLink({
      title: `Generated Now · ${new Date().toLocaleTimeString()}`,
      description: 'Mock: generated immediately',
      category: 'All Links',
      tags: ['generated'],
      url: `https://example.com/mock/gen/${Date.now()}`
    }, { silent: true });
    return { generated_card_id: link.id };
  },

  async generateDigest(params = {}) {
    await randDelay();
    const link = await storageAdapter.addLink({
      title: `Digest · ${new Date().toLocaleDateString()}`,
      description: 'Mock: digest for today',
      category: 'All Links',
      tags: ['digest'],
      url: `https://example.com/mock/digest/${Date.now()}`
    }, { silent: true });
    return { digest_card_id: link.id };
  }
};

export default mockService;
