import storageAdapter from "../storage/storageAdapter.js";
import { createDigestForWebsite } from "../services/ai.js";
import { DIGEST_TYPE } from "../config/constants.js";
import { linkController } from "./linkController.js";
import { normalizeUrl } from "../utils/url.js";

/**
 * Digest Controller
 * Handles business logic for digest generation and management.
 */
export const digestController = {
  
  /**
   * Generate a manual digest for a specific link
   * @param {number|string} linkId 
   * @returns {Promise<object>} The created digest record
   */
  async generateManualDigest(linkId) {
    if (!linkId) throw new Error('Link ID is required');
    
    // Get link data to ensure it exists and pass to AI service
    // linkController.getLinks() returns all links with subscription status
    // We can use storageAdapter directly or linkController
    const links = await storageAdapter.getLinks();
    const link = links.find(l => String(l.id) === String(linkId));
    
    if (!link) throw new Error('Link not found');
    
    // Call AI Service
    const record = await createDigestForWebsite(link, DIGEST_TYPE.MANUAL);
    return record;
  },

  /**
   * Generate daily digests for all active subscriptions (or specific one)
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

    // Optional: Check if already generated for today?
    // The requirement says "Query existing... merge logic".
    // For now, we'll generate for all active subs.
    // To prevent duplicates, we could check existing digests for today.
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

    for (const sub of activeSubs) {
        // Skip if already generated today (Merge logic: only add missing ones)
        if (processedLinkIds.has(String(sub.linkId))) {
            continue;
        }

        try {
            // fetch link data to pass to createDigestForWebsite
            // The sub object has linkId, but createDigestForWebsite expects a website object with url
            // storageAdapter.getSubscriptions returns { id, linkId, ... } 
            // We need the full link object.
            const links = await storageAdapter.getLinks();
            const link = links.find(l => String(l.id) === String(sub.linkId));
            
            if (link) {
                await createDigestForWebsite(link, DIGEST_TYPE.DAILY);
                successCount++;
            } else {
                // Link might be deleted but subscription remains? 
                // Should clean up, but for now just skip
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
   * Delete a digest entry
   * @param {string} id 
   */
  async deleteDigest(id) {
    await storageAdapter.deleteDigest(id);
  },

  /**
   * Helper to group digests for view (simulating the merge logic in dashboard.js)
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
                 meta: { trigger: 'user' } // Default
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
