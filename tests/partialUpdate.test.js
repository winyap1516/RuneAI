import { describe, it, expect, vi, beforeEach } from 'vitest';
// 中文注释：统一到 src/js 路径
import { linkController } from '../src/js/controllers/linkController.js';
import storageAdapter from '../src/js/storage/storageAdapter.js';

// Mock storageAdapter
vi.mock('../src/js/storage/storageAdapter.js', () => ({
    default: {
        getLinks: vi.fn(),
        getSubscriptions: vi.fn(),
        addLink: vi.fn(),
        updateLink: vi.fn(),
        deleteLink: vi.fn(),
        subscribeToLink: vi.fn(),
        updateSubscription: vi.fn(),
        ensureCategory: vi.fn(),
    }
}));

vi.mock('../src/js/utils/url.js', () => ({
    normalizeUrl: (u) => u
}));

describe('Phase 3 - Partial Update Controller Logic', () => {
    let mockView;

    beforeEach(() => {
        vi.clearAllMocks();
        mockView = {
            updateSingleCardUI: vi.fn(),
            addSingleCardUI: vi.fn(),
            removeSingleCardUI: vi.fn()
        };
        linkController.setView(mockView);
    });

    it('addLink should call addSingleCardUI and suppress storage notify', async () => {
        storageAdapter.getLinks.mockResolvedValue([]);
        storageAdapter.addLink.mockResolvedValue({ id: 1, title: 'Test' });

        await linkController.addLink('http://test.com');

        expect(storageAdapter.addLink).toHaveBeenCalledWith(
            expect.objectContaining({ url: 'http://test.com' }),
            expect.objectContaining({ silent: true })
        );
        expect(mockView.addSingleCardUI).toHaveBeenCalledWith({ id: 1, title: 'Test' });
    });

    it('updateLink should call updateSingleCardUI and suppress storage notify', async () => {
        storageAdapter.getLinks.mockResolvedValue([{ id: 1, url: 'http://test.com' }]);
        storageAdapter.updateLink.mockResolvedValue({ id: 1, title: 'Updated' });

        await linkController.updateLink(1, { title: 'Updated' });

        expect(storageAdapter.updateLink).toHaveBeenCalledWith(
            1,
            expect.objectContaining({ title: 'Updated' }),
            expect.objectContaining({ silent: true })
        );
        expect(mockView.updateSingleCardUI).toHaveBeenCalledWith(1, expect.objectContaining({ id: 1 }));
    });

    it('deleteLink should call removeSingleCardUI and suppress storage notify', async () => {
        storageAdapter.getLinks.mockResolvedValue([{ id: 1, url: 'http://test.com' }]);
        
        await linkController.deleteLink(1);

        expect(storageAdapter.deleteLink).toHaveBeenCalledWith(
            1,
            expect.objectContaining({ silent: true })
        );
        expect(mockView.removeSingleCardUI).toHaveBeenCalledWith(1);
    });

    it('subscribe should call updateSingleCardUI and suppress storage notify', async () => {
        storageAdapter.subscribeToLink.mockResolvedValue({ id: 'sub1', linkId: 1 });

        await linkController.subscribe(1);

        expect(storageAdapter.subscribeToLink).toHaveBeenCalledWith(
            1,
            expect.objectContaining({ silent: true })
        );
        expect(mockView.updateSingleCardUI).toHaveBeenCalledWith(1, { subscribed: true, subscriptionId: 'sub1' });
    });
});
