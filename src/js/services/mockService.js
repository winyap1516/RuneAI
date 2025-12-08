// 中文注释：前端 Mock 服务（脱离 Supabase 的开发/测试模式）
// 作用：提供与后端等价的接口层（getCards/getCategories/CRUD/订阅/生成 Digest），并在需要时加载静态 JSON 作为数据源。
// 说明：
// - 数据来源：public/mock/mock_bundle_v1 下的 JSON（通过 Vite 的 public 目录静态托管）
// - 存储后端：复用现有 storageAdapter（IndexedDB/LocalStorage 封装），以便 UI 与分页逻辑无缝工作
// - 延迟与失败：所有接口模拟 100–400ms 延迟，并支持 10% 失败注入（可通过 window.__MOCK_FAIL_RATE 配置）

import logger from '/src/js/services/logger.js';
import storageAdapter from '/src/js/storage/storageAdapter.js';

const BUNDLE_BASE = '/mock/mock_bundle_v1';
const INIT_FLAG_KEY = 'rune_mock_initialized';

// 运行时配置（非持久化，刷新重置，可通过控制台 window.mock.config 修改）
const config = {
  delay: 200,      // 基础延迟 (ms)
  jitter: 300,     // 随机抖动 (ms)
  failRate: 0.1,   // 失败率 (0.0 - 1.0)
  forceSeed: false // 是否强制重置 Seed
};

// 辅助函数
function getDelay() {
  return config.delay + Math.floor(Math.random() * config.jitter);
}

function delayPromise() {
  return new Promise(r => setTimeout(r, getDelay()));
}

function shouldFail() {
  return Math.random() < config.failRate;
}

// 原始 JSON 获取
async function fetchJSON(path) {
  const url = `${BUNDLE_BASE}/${path}`;
  logger.info('[MockService] Fetching Seed JSON:', url);
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
  const firstCatId = Array.isArray(card.category_ids) && card.category_ids.length ? card.category_ids[0] : null;
  const categoryName = firstCatId && id2name.has(firstCatId) ? id2name.get(firstCatId) : 'All Links';
  
  // 随机生成 Meta
  const sources = ['Twitter', 'Medium', 'RSS', 'Manual', 'Youtube'];
  const mockSource = sources[Math.floor(Math.random() * sources.length)];
  const mockAiStatus = Math.random() > 0.3 ? 'processed' : (Math.random() > 0.5 ? 'pending' : 'failed');
  
  // 随机 Tags
  const mockTagsPool = ['AI', 'Tech', 'Design', 'News', 'Tool', 'Tutorial', 'Startup', 'Crypto'];
  let tags = Array.isArray(card.tags) && card.tags.length ? card.tags : [];
  // 提高生成概率：只要为空就生成（仅保留 5% 概率为空，模拟真实情况）
  if (tags.length === 0 && Math.random() > 0.05) {
    const count = Math.floor(Math.random() * 3) + 1;
    const shuffled = mockTagsPool.sort(() => 0.5 - Math.random());
    tags = shuffled.slice(0, count);
  }

  return {
    id: card.id, // 保持原始 ID
    title: card.title || 'Untitled',
    description: String(card.content_preview || '').slice(0, 300) || 'AI summary (mock)',
    category: categoryName,
    tags: tags,
    url: card.url || `https://example.com/mock/${card.id}`,
    created_at: card.created_at || new Date().toISOString(),
    updated_at: card.updated_at || new Date().toISOString(),
    source: card.source || mockSource,
    ai_status: card.ai_status || mockAiStatus
  };
}

export const mockService = {
  // =============================
  // 1. 初始化与配置
  // =============================
  
  /**
   * 初始化 Mock 服务
   * - 检查是否已初始化
   * - 若未初始化或强制 Reset，则加载 Seed
   */
  async loadBundle(opts = {}) {
    logger.info('[MockService] Initializing...');
    
    // 合并配置
    if (opts.forceSeed) config.forceSeed = true;
    
    const isInitialized = localStorage.getItem(INIT_FLAG_KEY) === '1';
    // 优先检查 IDB 数据，防止 LS 丢失导致误重置
    const links = await storageAdapter.getLinks();
    const hasData = links.length > 0;
    
    if ((isInitialized || hasData) && !config.forceSeed) {
      if (hasData) {
        logger.info(`[MockService] Already initialized. Local records: ${links.length}. Skipping seed.`);
        
        // P0 Fix: 自动修复旧数据中缺失的 Tags/Meta（针对 Mock 升级场景）
        let fixCount = 0;
        for (const link of links) {
          let changed = false;
          // 补全 Tags
          // 修复：仅当 tags 字段完全缺失时才补全；如果 tags 是空数组 []，则视为用户有意清空，不应覆盖。
          // 之前的逻辑 if (!Array.isArray(link.tags) || link.tags.length === 0) 会误判空数组为缺失。
          // 我们只处理 undefined 或 null 的情况。
          if (link.tags === undefined || link.tags === null) {
            // 30% 概率保持无标签，70% 概率补全
            if (Math.random() > 0.3) {
              const mockTagsPool = ['AI', 'Tech', 'Design', 'News', 'Tool', 'Tutorial', 'Startup', 'Crypto'];
              const count = Math.floor(Math.random() * 3) + 1;
              link.tags = mockTagsPool.sort(() => 0.5 - Math.random()).slice(0, count);
              changed = true;
            } else {
              // 显式设置为空数组，避免下次再次进入此逻辑
              link.tags = [];
              changed = true;
            }
          }
          // 补全 Source
          if (!link.source) {
            const sources = ['Twitter', 'Medium', 'RSS', 'Manual', 'Youtube'];
            link.source = sources[Math.floor(Math.random() * sources.length)];
            changed = true;
          }
          // 补全 AI Status
          if (!link.ai_status) {
            link.ai_status = Math.random() > 0.3 ? 'processed' : (Math.random() > 0.5 ? 'pending' : 'failed');
            changed = true;
          }

          if (changed) {
            await storageAdapter.updateLink(link.id, link, { silent: true });
            fixCount++;
          }
        }
        
        if (fixCount > 0) {
          logger.info(`[MockService] Auto-patched ${fixCount} cards with missing tags/meta.`);
          // 触发 UI 刷新
          await storageAdapter.notify({ type: 'links_changed' });
        }

        return; // 已有数据，直接使用本地
      }
    }

    // 执行 Seed 加载
    await this.resetToSeed();
  },

  async resetToSeed() {
    logger.info('[MockService] Resetting to Seed Data...');
    await delayPromise();

    // 1. 清空现有数据
    const currentLinks = await storageAdapter.getLinks();
    // 并发删除所有 Links
    await Promise.all(currentLinks.map(l => storageAdapter.deleteLink(l.id, { silent: true })));
    
    // 清空分类 (LocalStorage) - 这里假设 storageAdapter 没有提供 deleteCategory，我们只能覆盖或手动清空
    // 目前 storageAdapter.getCategories() 读取的是 LocalStorage[KEYS.CATEGORIES]
    // 我们可以通过 storageAdapter 覆盖为空，或依靠后续 ensureCategory 重建
    // 但为了彻底，最好手动清理一下 LS 中的 categories（如果 apiRouter 允许的话）
    // 由于我们不能直接操作 storageAdapter 内部 key，这里通过 ensureCategory 重新构建即可，
    // 或者我们假设 Seed 会覆盖/追加。为了“重置”效果，最好能清空。
    // 既然是 Mock 模式，我们可以直接操作 LS（如果知道 Key）
    try { localStorage.removeItem('rune_categories'); } catch {}

    // 2. 加载 Seed JSON
    const categories = await fetchJSON('mock_categories.json');
    const cards = await fetchJSON('mock_cards.json');
    const id2name = buildCategoryMap(categories);

    // 3. 写入分类
    for (const c of categories) { 
      await storageAdapter.ensureCategory(c.name); 
    }

    // 4. 写入卡片
    for (const card of cards) {
      const link = normalizeCardToLink(card, id2name);
      // 使用 silent: true 避免大量 UI 刷新事件
      await storageAdapter.addLink(link, { silent: true });
    }

    // 5. 标记已初始化
    localStorage.setItem(INIT_FLAG_KEY, '1');
    
    // 6. 通知 UI 刷新
    await storageAdapter.notify({ type: 'links_changed' });
    
    logger.info(`[MockService] Seed loaded: ${cards.length} cards, ${categories.length} categories.`);
  },

  // 中文注释：加载 UI Fixture 数据集以便前端联调（示例：empty/100）
  // 使用方式：window.mock.service.loadFixture('empty'|'100')
  async loadFixture(name = 'empty') {
    logger.info('[MockService] Loading UI fixture:', name);
    await delayPromise();

    // 统一清空现有链接数据
    const currentLinks = await storageAdapter.getLinks();
    await Promise.all(currentLinks.map(l => storageAdapter.deleteLink(l.id, { silent: true })));    

    // 预备分类集合（保持与种子一致，便于侧栏渲染）
    const categories = await fetchJSON('mock_categories.json');
    for (const c of categories) {
      await storageAdapter.ensureCategory(c.name);
    }

    // 分支：empty → 不加载任何卡片
    if (name === 'empty') {
      await storageAdapter.notify({ type: 'links_changed' });
      return { ok: true, loaded: 0 };
    }

    // 分支：100 → 加载 100 条复杂卡片（ui_fixtures/cards-100.json）
    if (name === '100') {
      const id2name = buildCategoryMap(categories);
      const fixtures = await fetchJSON('ui_fixtures/cards-100.json');
      let loaded = 0;
      for (const card of fixtures) {
        const link = normalizeCardToLink(card, id2name);
        await storageAdapter.addLink(link, { silent: true });
        loaded++;
      }
      await storageAdapter.notify({ type: 'links_changed' });
      return { ok: true, loaded };
    }

    // 未知名称：回退为 empty
    await storageAdapter.notify({ type: 'links_changed' });
    return { ok: true, loaded: 0 };
  },

  // 暴露配置接口
  setConfig(newConfig = {}) {
    Object.assign(config, newConfig);
    logger.info('[MockService] Config updated:', config);
  },

  // =============================
  // 2. API 接口 (Persistent CRUD)
  // =============================

  async getCards(params = {}) {
    await delayPromise();
    if (shouldFail()) throw { code: 'SERVER_TIMEOUT', message: 'Mock Network Timeout' };
    // 从本地存储读取，确保包含用户的修改
    return await storageAdapter.getLinks();
  },

  async getCard(id) {
    await delayPromise();
    const links = await storageAdapter.getLinks();
    const found = links.find(c => String(c.id) === String(id));
    if (!found) throw { code: 'NOT_FOUND', message: 'Card not found' };
    return found;
  },

  async createCard(payload) {
    await delayPromise();
    if (shouldFail()) throw { code: 'INVALID_PAYLOAD', message: 'Mock Validation Failed' };
    
    // 写入本地存储
    const added = await storageAdapter.addLink({
      ...payload,
      id: payload.id, // 允许指定 ID
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { silent: true });
    
    return { created_card_id: added.id, card: added };
  },

  async updateCard(id, payload) {
    await delayPromise();
    if (shouldFail()) throw { code: 'NETWORK_ERROR', message: 'Mock Network Error' };
    
    await storageAdapter.updateLink(id, payload, { silent: true });
    return { ok: true };
  },

  async deleteCard(id, opts = {}) {
    await delayPromise();
    // 模拟后端业务逻辑
    if (opts?.status === 'published') {
      return { requires_confirm_unpublish: true };
    }
    await storageAdapter.deleteLink(id, { silent: true });
    return { ok: true };
  },

  async getCategories() {
    await delayPromise();
    return await storageAdapter.getCategories();
  },

  async createCategory(name) {
    await delayPromise();
    if (shouldFail()) throw { code: 'SERVER_ERROR', status: 500 };
    await storageAdapter.ensureCategory(name);
    return { ok: true };
  },

  async subscribe(cardId) {
    await delayPromise();
    // 写入本地订阅状态
    await storageAdapter.subscribeToLink(cardId, { silent: true });
    return { success: true, status: 'subscribed' };
  },

  async generateNow(params = {}) {
    await delayPromise();
    const link = await storageAdapter.addLink({
      title: `Generated Now · ${new Date().toLocaleTimeString()}`,
      description: 'Mock: This card was generated locally and saved to localStorage.',
      category: 'All Links',
      tags: ['generated', 'mock'],
      url: `https://example.com/mock/gen/${Date.now()}`,
      source: 'Manual',
      ai_status: 'processed'
    }, { silent: true });
    return { generated_card_id: link.id };
  },

  async generateDigest(params = {}) {
    await delayPromise();
    const link = await storageAdapter.addLink({
      title: `Digest · ${new Date().toLocaleDateString()}`,
      description: 'Mock: Daily digest generated locally.',
      category: 'All Links',
      tags: ['digest', 'mock'],
      url: `https://example.com/mock/digest/${Date.now()}`,
      source: 'AI Digest',
      ai_status: 'processed'
    }, { silent: true });
    return { digest_card_id: link.id };
  }
};

// 挂载全局调试对象
if (typeof window !== 'undefined') {
  window.mock = {
    service: mockService,
    config: config,
    reset: () => mockService.resetToSeed(),
    setDelay: (ms) => mockService.setConfig({ delay: ms }),
    setFailRate: (rate) => mockService.setConfig({ failRate: rate })
  };
  console.log('%c[MockService] Debug tool available at window.mock', 'color: #4A69FF; font-weight: bold;');
}

export default mockService;
