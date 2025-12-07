/**
 * @vitest-environment jsdom
 */
// 中文注释：LinkController 回归测试 (Phase 5 修复验证)
// 验证目标：
// 1. 静态导入 storageAdapter 是否正常工作（无重复模块错误）
// 2. saveWebsiteContent 是否被正确调用
// 3. 基础 CRUD 功能

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock storageAdapter to spy on calls
vi.mock('/src/js/storage/storageAdapter.js', () => {
  return {
    default: {
      getLinks: vi.fn().mockResolvedValue([]),
      addLink: vi.fn().mockImplementation(async (data) => ({ ...data, id: Date.now() })),
      getSubscriptions: vi.fn().mockResolvedValue([]),
      ensureCategory: vi.fn(),
    },
    saveWebsiteContent: vi.fn().mockResolvedValue(true)
  };
});

// Mock UI View
const mockView = {
  addSingleCardUI: vi.fn(),
  updateSingleCardUI: vi.fn(),
  removeSingleCardUI: vi.fn(),
  appendPage: vi.fn()
};

// Import controller AFTER mocks
import { linkController } from '../src/js/controllers/linkController.js';
import storageAdapter, { saveWebsiteContent } from '/src/js/storage/storageAdapter.js';

describe('LinkController Regression (Static Import Fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    linkController.setView(null); // Reset view
  });

  it('should use static import for saveWebsiteContent without error', async () => {
    // 验证 addLink 流程中是否调用了 saveWebsiteContent
    // 注意：addLink 内部是 Promise.resolve().then(...) 异步调用
    
    const newLink = await linkController.addLink('https://example.com/regression-test');
    
    expect(newLink).toBeDefined();
    expect(storageAdapter.addLink).toHaveBeenCalled();
    
    // 等待微任务队列（确保 saveWebsiteContent 被调用）
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // 验证 saveWebsiteContent 被调用（mockFetchSiteContentExternal 默认会返回 mock 数据触发此逻辑）
    // 由于 mockFetchSiteContentExternal 是在 controller 内部引入的 mockFunctions，
    // 我们需要确保它返回了 content，才能触发 saveWebsiteContent。
    // 默认 mockFetchSiteContent 返回 { data: { content: '...' } }
    
    expect(saveWebsiteContent).toHaveBeenCalled();
    const args = saveWebsiteContent.mock.calls[0];
    expect(args[0]).toBe(newLink.id);
    expect(args[1]).toHaveProperty('content');
  });

  it('should handle view updates when view is set', async () => {
    linkController.setView(mockView);
    await linkController.addLink('https://example.com/view-test');
    
    expect(mockView.addSingleCardUI).toHaveBeenCalled();
  });
});
