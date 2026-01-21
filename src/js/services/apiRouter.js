// 中文注释：API 路由入口（Mock / Supabase 自动切换）
// 作用：根据环境变量 VITE_USE_MOCK 或全局 window.__FORCE_MOCK__ 开关，选择使用 mockService 或真实 supabase API 封装。

// 中文注释：API 路由入口（Mock / Supabase 自动切换）
// 修复点：此前以 `import * as mockApi` 导入导致导出的是模块命名空间对象，
// 在 dashboard_init.js 中调用 `mockApi.loadBundle()` 会因命名空间不含该方法而报错。
// 解决：改为默认导入 `mockService`，并在 `api` 变量中直接选择对象实例。
import logger from '/src/js/services/logger.js';
import { config } from '/src/js/services/config.js';
import { pythonApi } from '/src/js/services/pythonApi.js';
import storageAdapter from '/src/js/storage/storageAdapter.js';

logger.info('[ApiRouter] 初始化:', { useLocalDev: config.useLocalDev });

// Python API 适配层
const pythonAdapter = {
  // 读取类：优先从后端读，失败则回退本地
  async getCards() { 
    try {
      if (config.useLocalDev) {
        const links = await pythonApi.getLinks();
        // 简单映射后端数据到前端 Card 格式
        return links.map(l => ({
          id: l.id,
          title: l.url, // 暂时用 URL 作标题，等后端爬虫升级
          url: l.url,
          description: l.description || 'Processing...',
          category: 'All Links',
          tags: l.ai_status === 'completed' ? ['completed'] : ['processing'],
          ai_status: l.ai_status,
          created_at: l.created_at
        }));
      }
    } catch (e) {
      logger.warn('[ApiRouter] Python API getCards failed, falling back to local storage', e);
    }
    return await storageAdapter.getLinks(); 
  },

  async getCard(id) { 
    if (config.useLocalDev) {
      try {
        return await pythonApi.getLink(id);
      } catch (e) { logger.warn('Python getLink failed', e); }
    }
    const list = await storageAdapter.getLinks(); 
    return list.find(x => String(x.id) === String(id)); 
  },

  // 写入类：本地模式下，createCard 实际上由 linkController 接管了 (syncLink)
  // 但为了兼容旧代码调用，这里依然保留 storageAdapter 作为底层
  async createCard(payload) { return await storageAdapter.addLink(payload, { silent: true }); },
  async updateCard(id, payload) { await storageAdapter.updateLink(id, payload, { silent: true }); return { ok: true }; },
  async deleteCard(id) { await storageAdapter.deleteLink(id, { silent: true }); return { ok: true }; },
  
  // 分类与订阅：暂时仍用本地
  async getCategories() { return await storageAdapter.getCategories(); },
  async createCategory(name) { await storageAdapter.ensureCategory(name); return { ok: true }; },
  async subscribe(cardId) { await storageAdapter.subscribeToLink(cardId, { silent: true }); return { success: true }; },
  
  // 生成类：占位
  async generateNow() { return { generated_card_id: 'not-impl' }; },
  async generateDigest() { return { digest_card_id: 'not-impl' }; }
};

// 中文注释：不再默认导出 storageAdapter 伪装的 api，而是导出适配过 Python 的版本
export const api = pythonAdapter;
export default { api };

// 中文注释：暴露开发期切换工具（需刷新页面方可生效）
if (typeof window !== 'undefined') {
  try {
    window.forceMock = (enabled = true) => {
      window.__FORCE_MOCK__ = !!enabled;
      console.warn('[ApiRouter] 已设置 __FORCE_MOCK__ =', window.__FORCE_MOCK__, '请刷新页面以应用切换');
    };
  } catch {}
}
