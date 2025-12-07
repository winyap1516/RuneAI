import { describe, it, expect, vi, beforeEach } from 'vitest';
// 中文注释：统一到 src/js 路径，保持测试与源码一致
import { linkController } from '../src/js/controllers/linkController.js';
import { digestController } from '../src/js/controllers/digestController.js';
import storageAdapter from '../src/js/storage/storageAdapter.js';
import { websites, digests } from '../src/js/storage/db.js';
import 'fake-indexeddb/auto';

// Mock localStorage
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: function(key) {
      return store[key] || null;
    },
    setItem: function(key, value) {
      store[key] = value.toString();
    },
    clear: function() {
      store = {};
    },
    removeItem: function(key) {
      delete store[key];
    }
  };
})();

global.window = {
    dispatchEvent: vi.fn()
};
global.localStorage = localStorageMock;

describe('Phase 3 - Pagination', () => {
    beforeEach(async () => {
        // Clear DB
        const db = await import('../src/js/storage/db.js');
        const conn = await db.default.openDB();
        const tx = conn.transaction(['websites', 'digests'], 'readwrite');
        tx.objectStore('websites').clear();
        tx.objectStore('digests').clear();
        await new Promise(r => tx.oncomplete = r);
    });

    it('should paginate links', async () => {
        // 1. Inject 50 links
        for (let i = 0; i < 50; i++) {
            await storageAdapter.addLink({ url: `http://test${i}.com`, title: `Link ${i}` });
        }

        // 2. Fetch Page 0 (Limit 20)
        const page0 = await linkController.fetchPage(0, 20);
        expect(page0.items.length).toBe(20);
        expect(page0.total).toBe(50);
        expect(page0.hasMore).toBe(true);
        // Verify order (prev = newest first). Last added (Link 49) should be first?
        // storageAdapter.addLink adds sequentially. 
        // db.js uses 'prev' cursor.
        // So items[0] should be Link 49.
        expect(page0.items[0].url).toBe('http://test49.com');

        // 3. Fetch Page 1
        const page1 = await linkController.fetchPage(1, 20);
        expect(page1.items.length).toBe(20);
        expect(page1.items[0].url).toBe('http://test29.com'); // 49 - 20 = 29

        // 4. Fetch Page 2 (Last 10)
        const page2 = await linkController.fetchPage(2, 20);
        expect(page2.items.length).toBe(10);
        expect(page2.hasMore).toBe(false);
    });

    it('should paginate digests', async () => {
        // 1. Inject 25 digests
        // We need a link first
        const link = await storageAdapter.addLink({ url: 'http://d.com' });
        
        for (let i = 0; i < 25; i++) {
            await storageAdapter.addDigest({
                website_id: link.id,
                summary: `Summary ${i}`,
                type: 'manual'
            });
        }

        // 2. Fetch Page 0 (Limit 10)
        const page0 = await digestController.fetchPage(0, 10);
        expect(page0.items.length).toBe(10);
        expect(page0.total).toBe(25);
        
        // 3. Fetch Page 2 (Last 5)
        const page2 = await digestController.fetchPage(2, 10);
        expect(page2.items.length).toBe(5);
        expect(page2.hasMore).toBe(false);
    });
});
