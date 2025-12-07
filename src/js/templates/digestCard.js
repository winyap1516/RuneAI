import { DIGEST_TYPE } from "../config/constants.js";
import { escapeHTML } from "../utils/ui-helpers.js";

/**
 * Create Digest Card HTML
 * @param {object} d Digest data object
 * @returns {string} HTML string
 */
export function createDigestCard(d) {
  const entries = d.entries || d.items || [];
  const siteCount = entries.length;
  const ts = d.timestamp || d.updated_at || d.created_at || Date.now();
  const tsText = new Date(ts).toLocaleString();
  
  const maxSites = 5;
  const shownEntries = entries.slice(0, maxSites);
  const moreCount = entries.length > maxSites ? entries.length - maxSites : 0;

  // Badges
  let typeBadge = '';
  if (d.type === 'single' || d.type === DIGEST_TYPE.MANUAL) {
    typeBadge = `<span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Manual</span>`;
  } else if (d.type === DIGEST_TYPE.DAILY) {
    typeBadge = `<span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800">Daily</span>`;
  }

  let sourceText = 'User';
  if (d.meta && d.meta.trigger === 'ai') sourceText = 'AI Scheduled';

  const itemsHtml = shownEntries.map(e => {
    const initial = (e.title || e.url || 'U').charAt(0).toUpperCase();
    return `
      <div class="flex items-center gap-2 p-1 rounded hover:bg-gray-50 dark:hover:bg-white/5">
         <div class="w-6 h-6 shrink-0 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold border border-indigo-100 dark:border-indigo-800">
           ${escapeHTML(initial)}
         </div>
         <div class="text-xs truncate text-text-secondary-light dark:text-text-secondary-dark flex-1" title="${escapeHTML(e.title||e.url)}">
           ${escapeHTML(e.title||e.url)}
         </div>
      </div>
    `;
  }).join('');

  const moreHtml = moreCount > 0 ? `<div class="text-xs text-text-secondary-light dark:text-text-secondary-dark pl-9">+${moreCount} more sites...</div>` : '';

  return `
    <div class="digest-card bg-surface-light dark:bg-surface-dark rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer relative group flex flex-col h-full" data-digest-id="${d.id}">
      <div class="flex justify-between items-start mb-3">
        <div>
           <div class="flex items-center gap-2 mb-1">
             ${typeBadge}
             <span class="text-[10px] text-text-secondary-light dark:text-text-secondary-dark border border-gray-200 dark:border-gray-700 rounded px-1">Src: ${sourceText}</span>
           </div>
           <div class="font-bold text-lg text-text-primary-light dark:text-text-primary-dark mb-1">${escapeHTML(d.title)}</div>
           <div class="text-xs text-text-secondary-light dark:text-text-secondary-dark">${escapeHTML(d.date)} · 1 day</div>
        </div>
        <div class="opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-3">
           <button class="digest-delete p-1.5 rounded-full bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600" data-id="${escapeHTML(d.id)}" title="Delete">
             <span class="material-symbols-outlined text-lg">delete</span>
           </button>
        </div>
      </div>
      
      <div class="flex items-center justify-between mb-4">
         <div class="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark bg-gray-100 dark:bg-white/5 px-2 py-1 rounded">ID: ${escapeHTML(d.id).slice(0, 8)}...</div>
         <div class="text-xs font-semibold text-primary">${siteCount} sites</div>
      </div>

      <div class="flex-1 flex flex-col gap-2">
         ${itemsHtml}
         ${moreHtml}
      </div>
      <div class="mt-3 flex items-center justify-end gap-3">
        <div class="text-xs text-text-secondary-light dark:text-text-secondary-dark">Generated at: ${escapeHTML(tsText)}</div>
        <button class="digest-view-btn btn btn-small btn-outline" data-id="${escapeHTML(d.id)}">
          <span class="material-symbols-outlined text-base">chevron_right</span> View Summary
        </button>
      </div>
    </div>
  `;
}
