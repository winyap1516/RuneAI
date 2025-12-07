/* @vitest-environment jsdom */
// 中文注释：
// 1) 指定 jsdom 测试环境，提供浏览器 API（window/localStorage/CustomEvent 等），避免 Node 环境下的 localStorage / indexedDB 警告。
// 2) mock 必须在 import 之前执行，确保被测模块（digestController、storageAdapter、ai/quota）加载到的是模拟版本，防止触发真实的 IndexedDB 迁移逻辑。
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 先进行模块模拟（mock），再导入被测模块与依赖
// 中文注释：迁移到 src/js 路径，保持测试与源码一致
vi.mock('../src/js/storage/storageAdapter.js');
vi.mock('../src/js/services/ai.js');
vi.mock('../src/js/services/quota.js');
vi.mock('../src/js/utils/url.js', () => ({ normalizeUrl: (u) => u }));

import { digestController } from '../src/js/controllers/digestController.js';
import storageAdapter from '../src/js/storage/storageAdapter.js';
import { createDigestForWebsite } from '../src/js/services/ai.js';
import * as quotaService from '../src/js/services/quota.js';

describe('Digest Controller', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    storageAdapter.getUser.mockReturnValue({ id: 'test-user' });
  });

  it('generateManualDigest should succeed when quota ok and AI ok', async () => {
    // Setup
    quotaService.canGenerate.mockResolvedValue(true);
    storageAdapter.getLinks.mockResolvedValue([{ id: '1', url: 'http://example.com' }]);
    createDigestForWebsite.mockResolvedValue({ ok: true, summary: 'test summary', metadata: {} });
    storageAdapter.addDigest.mockResolvedValue({ id: 'd1' });

    // Execute
    const result = await digestController.generateManualDigest('1');

    // Verify
    expect(createDigestForWebsite).toHaveBeenCalled();
    expect(storageAdapter.addDigest).toHaveBeenCalledWith(expect.objectContaining({
        summary: 'test summary',
        type: 'manual'
    }));
    expect(storageAdapter.addGenerationLog).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success'
    }));
    expect(result).toEqual({ id: 'd1' });
  });

  it('generateManualDigest should throw and log error when AI fails', async () => {
    // Setup
    quotaService.canGenerate.mockResolvedValue(true);
    storageAdapter.getLinks.mockResolvedValue([{ id: '1', url: 'http://example.com' }]);
    createDigestForWebsite.mockResolvedValue({ ok: false, error: { code: 'AI_ERROR', message: 'fail' } });

    // Execute & Verify
    await expect(digestController.generateManualDigest('1')).rejects.toThrow('fail');
    
    expect(storageAdapter.addGenerationLog).toHaveBeenCalledWith(expect.objectContaining({
        status: 'failed',
        error: expect.objectContaining({ code: 'AI_ERROR' })
    }));
    expect(storageAdapter.addDigest).not.toHaveBeenCalled();
  });

  it('generateManualDigest should throw when quota reached', async () => {
    quotaService.canGenerate.mockResolvedValue(false);
    await expect(digestController.generateManualDigest('1')).rejects.toThrow('DAILY_LIMIT_REACHED');
    expect(createDigestForWebsite).not.toHaveBeenCalled();
  });
});
