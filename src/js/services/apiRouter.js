// 中文注释：API 路由入口（Mock / Supabase 自动切换）
// 作用：根据环境变量 VITE_USE_MOCK 或全局 window.__FORCE_MOCK__ 开关，选择使用 mockService 或真实 supabase API 封装。

// 中文注释：API 路由入口（Mock / Supabase 自动切换）
// 修复点：此前以 `import * as mockApi` 导入导致导出的是模块命名空间对象，
// 在 dashboard_init.js 中调用 `mockApi.loadBundle()` 会因命名空间不含该方法而报错。
// 解决：改为默认导入 `mockService`，并在 `api` 变量中直接选择对象实例。
import logger from '/src/js/services/logger.js';
import { config } from '/src/js/services/config.js';
import mockService from '/src/js/services/mockService.js';

// 中文注释：真实 API 封装占位（当前项目主要通过 storageAdapter + linkController 完成 UI 渲染）
// 为保持接口一致性，这里提供最小实现，未来可替换为 Edge Functions / REST。
import storageAdapter from '/src/js/storage/storageAdapter.js';

const useMock = config.useMock;
const mockApiBase = config.mockApiBase;
if (useMock) {
  logger.info('[ApiRouter] 使用 Mock API');
} else {
  logger.info('[ApiRouter] 使用 Supabase API（占位封装）');
}

// 中文注释：占位实现的 supabaseApi（复用 storageAdapter 保持 UI 运行）
const supabaseApi = {
  async getCards() { return await storageAdapter.getLinks(); },
  async getCard(id) { const list = await storageAdapter.getLinks(); return list.find(x => String(x.id) === String(id)); },
  async createCard(payload) { return await storageAdapter.addLink(payload, { silent: true }); },
  async updateCard(id, payload) { await storageAdapter.updateLink(id, payload, { silent: true }); return { ok: true }; },
  async deleteCard(id) { await storageAdapter.deleteLink(id, { silent: true }); return { ok: true }; },
  async getCategories() { return await storageAdapter.getCategories(); },
  async createCategory(name) { await storageAdapter.ensureCategory(name); return { ok: true }; },
  async subscribe(cardId) { await storageAdapter.subscribeToLink(cardId, { silent: true }); return { success: true }; },
  async generateNow() { const c = await storageAdapter.addLink({ title: 'Generated (real)', url: `https://example.com/${Date.now()}`, category: 'All Links', description: 'Real placeholder', tags: [] }, { silent: true }); return { generated_card_id: c.id }; },
  async generateDigest() { const c = await storageAdapter.addLink({ title: 'Digest (real)', url: `https://example.com/${Date.now()}`, category: 'All Links', description: 'Real digest', tags: [] }, { silent: true }); return { digest_card_id: c.id }; }
};

// 中文注释：确保导出的 `api` 为可直接调用的方法对象
// Mock 模式：导出 `mockService`（包含 loadBundle/getCards/...）
// 非 Mock 模式：导出占位的 `supabaseApi`（复用 storageAdapter 保持 UI 可运行）
// 中文注释：HTTP Mock API 封装（使用外部 Docker Mock 服务）
const httpMockApi = mockApiBase ? {
  async getCards() {
    const resp = await fetch(`${mockApiBase}/api/cards`);
    return await resp.json();
  },
  async getCard(id) {
    const list = await this.getCards();
    return list.find(x => String(x.id) === String(id));
  },
  async createCard(payload) {
    // 简化：外部 Mock 暂不提供创建卡片接口，返回本地结果
    return payload;
  },
  async updateCard(id, payload) { return { ok: true }; },
  async deleteCard(id) { return { ok: true }; },
  async getCategories() {
    const cards = await this.getCards();
    const set = new Set(['All Links']);
    cards.forEach(c => { if (c?.category) set.add(c.category); });
    return Array.from(set);
  },
  async createCategory(name) { return { ok: true, name }; },
  async subscribe(cardId) { return { success: true }; },
  async generateNow({ user_id = 'guest', link_id = null } = {}) {
    const resp = await fetch(`${mockApiBase}/api/ai/digests/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id, link_id, mode: 'manual' }) });
    return await resp.json();
  },
  async generateDigest(params = {}) { return this.generateNow(params); },
  async getDigests() {
    const resp = await fetch(`${mockApiBase}/api/ai/digests`);
    return await resp.json();
  },
  // 中文注释：获取单条 Digest 详情（便于在前端写入本地缓存并刷新 UI）
  async getDigest(id) {
    const resp = await fetch(`${mockApiBase}/api/ai/digests/${id}`);
    if (!resp.ok) {
      throw new Error(`HTTP_${resp.status}`);
    }
    return await resp.json();
  },
  async getJob(id) {
    const resp = await fetch(`${mockApiBase}/api/jobs/${id}`);
    return await resp.json();
  }
} : null;

export const api = httpMockApi ? httpMockApi : (useMock ? mockService : supabaseApi);
export { useMock };
export default { api, useMock };

// 中文注释：暴露开发期切换工具（需刷新页面方可生效）
if (typeof window !== 'undefined') {
  try {
    window.forceMock = (enabled = true) => {
      window.__FORCE_MOCK__ = !!enabled;
      console.warn('[ApiRouter] 已设置 __FORCE_MOCK__ =', window.__FORCE_MOCK__, '请刷新页面以应用切换');
    };
  } catch {}
}
