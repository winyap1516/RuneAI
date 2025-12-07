import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// 中文注释：统一到 src/js 路径，避免旧路径找不到模块
import { linkController } from '../src/js/controllers/linkController.js';
import * as linksView from '../src/js/views/linksView.js';
import storageAdapter from '../src/js/storage/storageAdapter.js';
import 'fake-indexeddb/auto';

// Mock localStorage
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: function(key) { return store[key] || null; },
    setItem: function(key, value) { store[key] = value.toString(); },
    clear: function() { store = {}; },
    removeItem: function(key) { delete store[key]; }
  };
})();
global.localStorage = localStorageMock;
global.window = { 
    requestAnimationFrame: (cb) => cb(),
    dispatchEvent: vi.fn()
};

// Mock DOM container
const container = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  scrollTop: 0,
  scrollHeight: 1000,
  clientHeight: 500
};

describe('Phase 3 - Virtual Scrolling', () => {
    beforeEach(async () => {
        // Reset DB
        const db = await import('../src/js/storage/db.js');
        const conn = await db.default.openDB();
        const tx = conn.transaction(['websites'], 'readwrite');
        tx.objectStore('websites').clear();
        await new Promise(r => tx.oncomplete = r);

        // Seed 50 links
        for(let i=0; i<50; i++) {
            await storageAdapter.addLink({ url: `http://test${i}.com`, title: `Link ${i}` });
        }
        
        // Setup Controller
        linkController.setView(linksView);
        
        // Spy on View
        vi.spyOn(linksView, 'appendPage');
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should trigger loadNextPage on scroll to bottom', async () => {
        // Initialize Page 0
        await linkController.fetchPage(0, 20);
        expect(linkController._pagination.currentPage).toBe(0);

        // Enable Scroll
        let triggered = false;
        linksView.enableInfiniteScroll(container, {
            onLoadMore: () => {
                triggered = true;
                linkController.loadNextPage();
            }
        });
        
        const listener = container.addEventListener.mock.calls[0][1];
        expect(listener).toBeDefined();

        // Simulate Scroll
        container.scrollTop = 500; // Bottom reached
        listener(); // Trigger
        
        // Wait for async ops
        await new Promise(r => setTimeout(r, 50));

        expect(triggered).toBe(true);
        expect(linkController._pagination.currentPage).toBe(1);
        expect(linksView.appendPage).toHaveBeenCalled();
        
        // Verify items passed to appendPage
        const args = linksView.appendPage.mock.calls[0][0];
        expect(args.length).toBe(20);
    });

    it('should not load next page if hasMore is false', async () => {
        // Initialize Page 0
        await linkController.fetchPage(0, 20);
        
        // Manually load Page 1
        await linkController.loadNextPage();
        expect(linkController._pagination.currentPage).toBe(1);
        
        // Manually load Page 2 (Last page, 10 items)
        await linkController.loadNextPage();
        expect(linkController._pagination.currentPage).toBe(2);
        expect(linkController._pagination.hasMore).toBe(false);
        
        linksView.appendPage.mockClear();

        // Try load Page 3
        await linkController.loadNextPage();
        
        expect(linksView.appendPage).not.toHaveBeenCalled();
        expect(linkController._pagination.currentPage).toBe(2);
    });

    it('should prevent duplicate loads (locking)', async () => {
        await linkController.fetchPage(0, 20);
        
        // Trigger loadNextPage multiple times rapidly
        const p1 = linkController.loadNextPage();
        const p2 = linkController.loadNextPage();
        
        await Promise.all([p1, p2]);
        
        // Should only advance one page
        expect(linkController._pagination.currentPage).toBe(1);
        expect(linksView.appendPage).toHaveBeenCalledTimes(1);
    });
});
