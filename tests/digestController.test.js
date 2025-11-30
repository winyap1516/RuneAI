import { describe, it, expect, vi, beforeEach } from 'vitest';
import { digestController } from '../js/controllers/digestController.js';
import storageAdapter from '../js/storage/storageAdapter.js';
import { createDigestForWebsite } from '../js/services/ai.js';
import * as quotaService from '../js/services/quota.js';

// Mock dependencies
vi.mock('../js/storage/storageAdapter.js');
vi.mock('../js/services/ai.js');
vi.mock('../js/services/quota.js');
vi.mock('../js/utils/url.js', () => ({
    normalizeUrl: (u) => u
}));

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
