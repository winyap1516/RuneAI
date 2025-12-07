import storageAdapter from '../storage/storageAdapter.js';
import { LIMITS } from '../config/constants.js';

/**
 * Get usage count for a specific user and date
 * @param {string} userId 
 * @param {Date|number|string} date 
 * @returns {Promise<number>}
 */
export async function getUsage(userId, date = new Date()) {
    const d = new Date(date);
    // Set to beginning of the day
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    // Set to end of the day (next day 00:00)
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    // Note: storageAdapter is currently synchronous for history, but we keep this async for interface stability
    const history = storageAdapter.getGenerationHistory();
    
    const count = history.filter(entry => {
        // Filter by User (if userId provided)
        if (userId && entry.userId !== userId) return false;
        
        // Filter by Date
        if (entry.timestamp < startOfDay || entry.timestamp >= endOfDay) return false;
        
        // Only count successful generations
        if (entry.status !== 'success') return false;

        return true;
    }).length;

    return count;
}

/**
 * Check if user can generate digest
 * @param {string} userId 
 * @param {Date|number|string} date 
 * @returns {Promise<boolean>}
 */
export async function canGenerate(userId, date = new Date()) {
    const usage = await getUsage(userId, date);
    return usage < LIMITS.DAILY_GENERATE;
}
