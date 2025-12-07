import { describe, it, expect, vi } from 'vitest';
// 中文注释：统一导入路径为 src/js，避免旧 ../js 路径在重构后找不到模块
vi.mock('../src/js/utils/url.js', () => ({ normalizeUrl: (u) => u }));

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
