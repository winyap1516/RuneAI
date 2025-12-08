import { escapeHTML, getTagClass, buildIconHTML } from "/src/js/utils/ui-helpers.js";
import { normalizeUrl } from "/src/js/utils/url.js";

/**
 * Unified card template
 * @param {object} data Card data object
 * @returns {string} HTML string
 */
export function createCard(data = {}) {
  const { 
    id = "", 
    title = "Untitled", 
    description = "AI-generated summary placeholder…", 
    category = "", 
    tags = [], 
    url = "", 
    subscribed = false,
    source = "Manual", // 新增字段
    ai_status = "pending" // 新增字段
  } = data;

  // 统一ID格式：确保ID是数字类型
  const numericId = typeof id === 'string' && id ? parseInt(id, 10) : (typeof id === 'number' ? id : 0);

  // Tags 逻辑：最多显示 3 个，多余的显示 +N
  const maxTags = 3;
  const tagList = Array.isArray(tags) ? tags : [];
  const visibleTags = tagList.slice(0, maxTags);
  const remainingCount = tagList.length - maxTags;

  let tagsHtml = visibleTags.map((raw) => {
    const label = String(raw).trim();
    const colorCls = getTagClass(label);
    return `<span class="rune-tag ${colorCls} rounded-full px-2.5 py-1 text-xs font-medium border border-transparent">${escapeHTML(label)}</span>`;
  }).join("");

  if (remainingCount > 0) {
    tagsHtml += `<span class="rune-tag bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400 rounded-full px-2.5 py-1 text-xs font-medium border border-transparent">+${remainingCount}</span>`;
  }

  // AI Status 样式辅助
  const getAiStatusStyle = (status) => {
    switch (String(status).toLowerCase()) {
      case 'processed': return 'text-green-600 dark:text-green-400';
      case 'failed': return 'text-red-600 dark:text-red-400';
      default: return 'text-amber-600 dark:text-amber-400';
    }
  };
  const getAiStatusIcon = (status) => {
    switch (String(status).toLowerCase()) {
      case 'processed': return 'check_circle';
      case 'failed': return 'error';
      default: return 'hourglass_empty';
    }
  };

  const aiStatusColor = getAiStatusStyle(ai_status);
  const aiStatusIcon = getAiStatusIcon(ai_status);

  return `
    <div class="rune-card group relative rounded-xl border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-surface-dark p-3 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col h-full" data-card-id="${numericId}" data-category="${escapeHTML(category)}">
      <div class="rune-card-head flex items-start justify-between gap-3 mb-2">
        <div class="flex items-start gap-3 overflow-hidden">
          ${buildIconHTML({ title, url })}
          <div class="flex flex-col min-w-0">
            <div class="rune-card-title text-base font-bold truncate leading-tight mb-1" title="${escapeHTML(title)}">${escapeHTML(title)}</div>
            
            <!-- Meta Info: Source & AI Status -->
            <div class="flex items-center gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
               <span class="flex items-center gap-1 truncate" title="Source: ${escapeHTML(source)}">
                 <span class="material-symbols-outlined text-[14px]">public</span> 
                 <span class="max-w-[80px] truncate">${escapeHTML(source)}</span>
               </span>
               <span class="text-gray-300 dark:text-gray-600">•</span>
               <span class="flex items-center gap-1 ${aiStatusColor}" title="AI Status: ${escapeHTML(ai_status)}">
                 <span class="material-symbols-outlined text-[14px]">${aiStatusIcon}</span>
                 <span class="capitalize">${escapeHTML(ai_status)}</span>
               </span>
            </div>
          </div>
        </div>
        <button class="more-btn material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-white/10 rounded p-1 transition-colors shrink-0" title="More">more_horiz</button>
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

      <div class="rune-card-desc text-sm text-text-secondary-light dark:text-text-secondary-dark mb-3 line-clamp-3 flex-grow">${escapeHTML(description)}</div>
      
      <div class="rune-card-tags flex flex-wrap gap-2 mb-3">
        ${tagsHtml}
      </div>
      
      <div class="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700/50 card-actions flex items-center justify-between gap-2">
         <div class="text-xs text-gray-400 dark:text-gray-500 font-mono">
           ${data.created_at ? new Date(data.created_at).toLocaleDateString() : ''}
         </div>
         <div class="card-controls flex items-center gap-2">
           ${subscribed ? '<span class="subscribed-label text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">Subscribed</span>' : ''}
           <button class="btn-generate-once btn btn-small btn-outline text-xs px-2 py-1 h-auto min-h-0" data-sub-id="" data-link-id="${numericId}">Generate</button>
        </div>
      </div>
    </div>
  `;
}
