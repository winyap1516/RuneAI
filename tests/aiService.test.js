import { describe, it, expect, vi } from 'vitest';
// 中文注释：统一导入路径为 src/js，避免旧 ../js 路径在重构后找不到模块
// 中文注释：mock url 工具模块，导出 normalizeUrl 与 ensureAbsoluteUrl 以匹配被测模块的命名导入
vi.mock('../src/js/utils/url.js', () => ({
  // 中文注释：将归一化逻辑简化为恒等函数，便于单测断言
  normalizeUrl: (u) => u,
  // 中文注释：在单测中将绝对地址生成为输入本身，避免协议拼接差异影响调用
  ensureAbsoluteUrl: (u) => u
}));

describe('AI Service', () => {
  it('should return standardized success format', async () => {
    const { __setTestHooks, createDigestForWebsite } = await import('../src/js/services/ai.js');
    const mockAI = vi.fn().mockResolvedValue({ summary: 'test', title: 'Title' });
    __setTestHooks({ mockAIFromUrl: mockAI });
    const result = await createDigestForWebsite({ url: 'http://test.com' });
    expect(result).toEqual({
      ok: true,
      summary: 'test',
      metadata: {
        title: 'Title',
        tags: undefined,
        category: undefined
      }
    });
  });

  it('should return standardized error format on failure', async () => {
    const { __setTestHooks, createDigestForWebsite } = await import('../src/js/services/ai.js');
    const mockAI = vi.fn().mockRejectedValue(new Error('Network error'));
    __setTestHooks({ mockAIFromUrl: mockAI });
    const result = await createDigestForWebsite({ url: 'http://test.com' });
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'AI_NETWORK_ERROR',
        message: 'Network error',
        raw: expect.any(Error)
      }
    });
  });
});
