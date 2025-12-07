import { escapeHTML, getTagClass, buildIconHTML } from "../utils/ui-helpers.js";
import { normalizeUrl } from "../utils/url.js";

/**
 * Unified card template
 * @param {object} data Card data object
 * @returns {string} HTML string
 */
export function createCard(data = {}) {
  const { id = "", title = "Untitled", description = "AI-generated summary placeholder…", category = "", tags = [], url = "", subscribed = false } = data;
  // 统一ID格式：确保ID是数字类型（与数据库中的website_id保持一致）
  const numericId = typeof id === 'string' && id ? parseInt(id, 10) : (typeof id === 'number' ? id : 0);
  const tagsHtml = (Array.isArray(tags) ? tags : []).map((raw) => {
    const label = String(raw).trim();
    const colorCls = getTagClass(label);
    return `<span class="rune-tag ${colorCls} rounded-full px-2.5 py-1 text-xs font-medium border border-transparent">${escapeHTML(label)}</span>`;
  }).join("");

  return `
    <div class="rune-card group relative rounded-xl border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-surface-dark p-3 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all" data-card-id="${numericId}" data-category="${escapeHTML(category)}">
      <div class="rune-card-head flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          ${buildIconHTML({ title, url })}
          <div class="rune-card-title text-base font-bold">${escapeHTML(title)}</div>
        </div>
        <button class="more-btn material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-white/10 rounded p-1 transition-colors z-10" title="More">more_horiz</button>
      </div>
      
      <!-- Internal Menu -->
      <div class="rune-card-menu hidden absolute top-10 right-2 z-[9999] w-32 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 text-sm flex flex-col animate-in fade-in zoom-in-95 duration-100">
        <button class="menu-edit w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2">
          <span class="material-symbols-outlined text-base">edit</span> Edit
        </button>
        <button class="menu-delete w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2">
          <span class="material-symbols-outlined text-base">delete</span> Delete
        </button>
      </div>

      <div class="rune-card-desc text-sm mt-2 text-text-secondary-light dark:text-text-secondary-dark">${escapeHTML(description)}</div>
      <div class="rune-card-divider my-3"></div>
      <div class="rune-card-tags flex flex-wrap gap-2">
        ${tagsHtml}
      </div>
      <div class="mt-3 card-actions flex items-center justify-end gap-2">
        ${(() => { 
           const nurl = normalizeUrl(url); 
           const btnClass = subscribed ? 'hidden' : '';
           return `<button class="btn-subscribe btn btn-small btn-muted ${btnClass}" data-url="${escapeHTML(nurl)}">Subscribe</button>`; 
        })()}
        <div class="card-controls ${subscribed ? 'flex' : 'hidden'} items-center gap-2">
           <span class="text-sm font-bold text-primary px-2">Subscribed</span>
           <button class="btn-generate-once btn btn-small btn-outline" data-sub-id="" data-link-id="${numericId}">Generate Now</button>
        </div>
      </div>
    </div>
  `;
}
