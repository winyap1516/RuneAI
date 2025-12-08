// 中文注释：API 路由入口（Mock / Supabase 自动切换）
// 作用：根据环境变量 VITE_USE_MOCK 或全局 window.__FORCE_MOCK__ 开关，选择使用 mockService 或真实 supabase API 封装。

import logger from '/src/js/services/logger.js';
import { config } from '/src/js/services/config.js';
import * as mockApi from '/src/js/services/mockService.js';

// 中文注释：真实 API 封装占位（当前项目主要通过 storageAdapter + linkController 完成 UI 渲染）
// 为保持接口一致性，这里提供最小实现，未来可替换为 Edge Functions / REST。
import storageAdapter from '/src/js/storage/storageAdapter.js';

const useMock = config.useMock;
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

export const api = useMock ? mockApi : supabaseApi;
export { useMock };
export default { api, useMock };
