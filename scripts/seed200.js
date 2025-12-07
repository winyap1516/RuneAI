/**
 * 一次性灌 200 条模拟 links，供手动验证分页
 * Node 环境补 fake-indexeddb & 极简 localStorage
 */
import 'fake-indexeddb/auto';   // 提供 global.indexedDB

// 极简 localStorage mock
const localStorageMock = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};
global.localStorage = localStorageMock;
global.window = { dispatchEvent: () => {} };

// 现在再导入业务模块
// 中文注释：修复导入路径，Node 脚本从 scripts/ 相对到 src/js/
import storageAdapter from '../src/js/storage/storageAdapter.js';

async function seed() {
  console.log('🌱 Seeding 200 mock links...');
  const start = Date.now();
  for (let i = 0; i < 200; i++) {
    await storageAdapter.addLink({
      url: `https://example${i}.com`,
      title: `Example Link ${i}`,
      description: `This is the description for link ${i}`,
    });
  }
  console.log(`✅ 200 links inserted in ${Date.now() - start}ms`);
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
