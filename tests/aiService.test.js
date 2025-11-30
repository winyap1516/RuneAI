import { describe, it, expect, vi } from 'vitest';
import { createDigestForWebsite } from '../js/services/ai.js';
import { mockAIFromUrl } from '../mockFunctions.js';

// Mock internal imports of ai.js
// Since vitest mocks module level, we need to handle the imports inside ai.js
// ai.js imports mockAIFromUrl from ../../mockFunctions.js
vi.mock('../mockFunctions.js', () => ({
  mockAIFromUrl: vi.fn(),
  mockFetchSiteContent: vi.fn()
}));

vi.mock('../js/utils/url.js', () => ({
  normalizeUrl: (u) => u
}));

describe('AI Service', () => {
  it('should return standardized success format', async () => {
    mockAIFromUrl.mockResolvedValue({ summary: 'test', title: 'Title' });
    
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
    mockAIFromUrl.mockRejectedValue(new Error('Network error'));
    
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
