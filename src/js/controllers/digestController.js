import storageAdapter from "/src/js/storage/storageAdapter.js";
import { createDigestForWebsite } from "/src/js/services/ai.js";
import * as quotaService from "/src/js/services/quota.js";
import { DIGEST_TYPE, USER_ID } from "/src/js/config/constants.js";
import { normalizeUrl } from "/src/js/utils/url.js";

/**
 * Digest Controller
 * Handles business logic for digest generation and management.
 */
export const digestController = {
  _view: null,
  
  // Pagination State
  _pagination: {
    currentPage: 0,
    isLoading: false,
    hasMore: true
  },

  setView(view) {
      this._view = view;
  },
  
  /**
   * Generate a manual digest for a specific link
   * @param {number|string} linkId 
   * @returns {Promise<object>} The created digest record
   */
  async generateManualDigest(linkId) {
    if (!linkId) throw new Error('Link ID is required');
    
    const user = storageAdapter.getUser() || { id: USER_ID.DEFAULT };
    
    // Quota Check
    // 中文注释：每日限额检查（单测期望当返回 false 时抛出 DAILY_LIMIT_REACHED）
    const canGen = await quotaService.canGenerate(user.id);
    if (!canGen) {
        throw new Error("DAILY_LIMIT_REACHED");
    }

    const links = await storageAdapter.getLinks();
    const link = links.find(l => String(l.id) === String(linkId));
    
    if (!link) throw new Error('Link not found');
    
    // Call AI Service (Standardized Interface)
    // 中文注释：传入 link.id 以支持针对特定链接的生成
    const aiResponse = await createDigestForWebsite(link, DIGEST_TYPE.MANUAL, linkId);
    
    if (aiResponse.ok) {
        // Save to DB
        try {
            const record = await storageAdapter.addDigest({
                website_id: link.id,
                summary: aiResponse.summary,
                type: DIGEST_TYPE.MANUAL,
                metadata: aiResponse.metadata
            });
            
            // Log Success
            storageAdapter.addGenerationLog({
                userId: user.id,
                type: DIGEST_TYPE.MANUAL,
                linkId: link.id,
                status: 'success'
            });
            
            return record;
        } catch (dbErr) {
             console.error('[DigestController] DB Write Failed:', dbErr);
             // Log Failure (DB)
             storageAdapter.addGenerationLog({
                userId: user.id,
                type: DIGEST_TYPE.MANUAL,
                linkId: link.id,
                status: 'failed',
                error: { message: 'Database Write Failed', original: dbErr.message }
            });
            throw new Error('Failed to save digest to database');
        }
    } else {
        // Log Failure
        storageAdapter.addGenerationLog({
            userId: user.id,
            type: DIGEST_TYPE.MANUAL,
            linkId: link.id,
            status: 'failed',
            error: aiResponse.error
        });
        
        // Throw wrapped error
        const err = new Error(aiResponse.error.message);
        err.code = aiResponse.error.code;
        throw err;
    }
  },

  /**
   * Generate daily digests for all active subscriptions
   * @param {string} [targetLinkId] Optional link ID to filter
   * @returns {Promise<object>} Result summary { successCount, failedCount, errors }
   */
  async generateDailyDigest(targetLinkId = null) {
    const subs = await storageAdapter.getSubscriptions();
    let activeSubs = subs.filter(s => s.enabled !== false);
    
    if (targetLinkId) {
        activeSubs = activeSubs.filter(s => String(s.id) === String(targetLinkId) || String(s.linkId) === String(targetLinkId));
    }
    
    if (activeSubs.length === 0) {
        return { successCount: 0, failedCount: 0, errors: [] };
    }

    // Note: Daily generation might bypass quota or have separate logic. 
    // For now, we process without strict quota check per item to avoid partial failures if limit is low,
    // or we should check quota before starting? 
    // Given specific instructions were for Manual Digest, we leave this as is but update standard AI call.
    
    const todayStr = new Date().toISOString().slice(0, 10);
    const allDigests = await storageAdapter.getDigests();
    const todayDigests = allDigests.filter(d => 
        d.type === DIGEST_TYPE.DAILY && 
        new Date(d.created_at).toISOString().slice(0, 10) === todayStr
    );
    const processedLinkIds = new Set(todayDigests.map(d => String(d.website_id)));

    let successCount = 0;
    let failedCount = 0;
    const errors = [];
    const user = storageAdapter.getUser() || { id: USER_ID.DEFAULT };

    for (const sub of activeSubs) {
        if (processedLinkIds.has(String(sub.linkId))) {
            continue;
        }

        try {
            const links = await storageAdapter.getLinks();
            const link = links.find(l => String(l.id) === String(sub.linkId));
            
            if (link) {
                const aiResponse = await createDigestForWebsite(link, DIGEST_TYPE.DAILY);
                
                if (aiResponse.ok) {
                    await storageAdapter.addDigest({
                        website_id: link.id,
                        summary: aiResponse.summary,
                        type: DIGEST_TYPE.DAILY,
                        metadata: aiResponse.metadata
                    });
                    storageAdapter.addGenerationLog({
                        userId: user.id,
                        type: DIGEST_TYPE.DAILY,
                        linkId: link.id,
                        status: 'success'
                    });
                    successCount++;
                } else {
                    storageAdapter.addGenerationLog({
                        userId: user.id,
                        type: DIGEST_TYPE.DAILY,
                        linkId: link.id,
                        status: 'failed',
                        error: aiResponse.error
                    });
                    failedCount++;
                    errors.push({ linkId: sub.linkId, error: aiResponse.error.message });
                }
            } else {
                failedCount++;
            }
        } catch (err) {
            console.error(`Failed to generate digest for link ${sub.linkId}:`, err);
            failedCount++;
            errors.push({ linkId: sub.linkId, error: err.message });
        }
    }

    return { successCount, failedCount, errors };
  },

  /**
   * Get all digests
   * @returns {Promise<Array>}
   */
  async getDigestList() {
    return await storageAdapter.getDigests();
  },

  /**
   * Fetch paginated digests
   * @param {number} pageIndex 0-based index
   * @param {number} pageSize 
   * @returns {Promise<object>} { items, total, hasMore }
   */
  async fetchPage(pageIndex = 0, pageSize = 20) {
    // Sync state if page 0 is requested
    if (pageIndex === 0) {
        this._pagination.currentPage = 0;
        this._pagination.hasMore = true;
        this._pagination.isLoading = false;
    }
    
    const offset = pageIndex * pageSize;
    return await storageAdapter.getDigestsPage({ limit: pageSize, offset });
  },

  async loadNextPage() {
    if (this._pagination.isLoading || !this._pagination.hasMore) return;
    
    this._pagination.isLoading = true;
    try {
        const nextPage = this._pagination.currentPage + 1;
        const { items, total, hasMore } = await this.fetchPage(nextPage, 20);
        
        this._pagination.currentPage = nextPage;
        this._pagination.hasMore = hasMore;
        
        if (items.length > 0 && this._view) {
            // Note: appendPage in view handles merging
            this._view.appendPage(items);
        }
    } catch (err) {
        console.error('Failed to load next page:', err);
    } finally {
        this._pagination.isLoading = false;
    }
  },

  /**
   * Delete a digest entry
   * @param {string} id 
   */
  async deleteDigest(id) {
    await storageAdapter.deleteDigest(id);
  },

  /**
   * Helper to group digests for view
   * @param {Array} digests 
   * @param {Array} links 
   * @returns {Array} Grouped digest objects
   */
  mergeDigestEntries(digests, links) {
      const linkMap = new Map(links.map(l => [l.id, l]));
      const groups = {};

      digests.forEach(d => {
         const link = linkMap.get(d.website_id);
         if (!link) return; 
         
         const dateStr = new Date(d.created_at || Date.now()).toISOString().slice(0,10);
         const type = d.type || DIGEST_TYPE.DAILY;
         
         let groupKey;
         if (type === DIGEST_TYPE.DAILY) {
             groupKey = `daily_${dateStr}`;
         } else {
             groupKey = `single_${d.digest_id || d.created_at}_${d.website_id}`;
         }
         
         if (!groups[groupKey]) {
             groups[groupKey] = {
                 id: groupKey,
                 date: dateStr,
                 merged: type === DIGEST_TYPE.DAILY,
                 type: type,
                 title: type === DIGEST_TYPE.DAILY ? `AI Digest · ${dateStr}` : (link.title || 'Single Digest'),
                 created_at: d.created_at,
                 updated_at: d.created_at,
                 entries: [],
                 meta: { trigger: 'user' }
             };
         }
         
         groups[groupKey].entries.push({
             id: d.id,
             subscriptionId: link.id,
             url: normalizeUrl(link.url),
             title: link.title || link.url,
             summary: d.summary || '',
             website_id: d.website_id,
             raw_digest_id: d.digest_id,
             created_at: d.created_at
         });
      });
      
      return Object.values(groups).sort((a,b) => String(b.date).localeCompare(String(a.date)));
  },

  /**
   * Get daily usage count for a user
   * @param {string} userId 
   * @param {string} type 
   * @returns {number}
   */
  getDailyUsageCount(userId, type) {
    return storageAdapter.getDailyUsageCount(userId, type);
  },

  /**
   * Get last generation time for a link
   * @param {number|string} linkId 
   * @param {string} type 
   * @returns {number} timestamp
   */
  getLastGenerationTime(linkId, type) {
    return storageAdapter.getLastGenerationTime(linkId, type);
  }
};
