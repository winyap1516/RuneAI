// =============================
// 🎨 UI Helper Functions
// =============================

/**
 * Safely escape HTML to prevent malicious script injection
 * @param {string} str 
 * @returns {string}
 */
export function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Extract domain from URL
 * @param {string} url 
 * @returns {string} domain or empty string
 */
export function getDomainFromUrl(url) {
  try {
    if (!url) return "";
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname;
  } catch (e) {
    return "";
  }
}

/**
 * Build card icon HTML with Favicon support
 * @param {object} param0 { title, url }
 * @returns {string} HTML string
 */
export function buildIconHTML({ title = "", url = "" } = {}) {
  const initial = (title || url || "U").trim().charAt(0).toUpperCase() || "U";
  const domain = getDomainFromUrl(url);
  
  // Google Favicon API (sz=64 for high res)
  const faviconUrl = domain 
    ? `https://www.google.com/s2/favicons?sz=64&domain=${domain}`
    : "";

  if (!faviconUrl) {
    return `
      <div class="rune-card-icon w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center text-base font-bold text-gray-600 dark:text-gray-300">
        ${escapeHTML(initial)}
      </div>
    `;
  }

  // 使用 img 标签并处理 onerror 回退到首字母
  // 注意：为了防止闪烁，我们可以设置一个背景色
  return `
    <div class="rune-card-icon w-10 h-10 rounded-lg bg-gray-50 dark:bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
      <img 
        src="${faviconUrl}" 
        alt="${escapeHTML(title)}" 
        class="w-full h-full object-cover"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
      />
      <div class="w-full h-full items-center justify-center text-base font-bold text-gray-600 dark:text-gray-300 hidden" style="display: none;">
        ${escapeHTML(initial)}
      </div>
    </div>
  `;
}

/**
 * Get Tailwind color classes based on tag keywords (Auto-color system)
 * @param {string} tag 
 * @returns {string} Tailwind classes
 */
export function getTagClass(tag = "") {
  const t = tag.toLowerCase().trim();
  if (!t) return "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300";
  
  const colors = [
    "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300",
    "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300",
    "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-300",
    "bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-300",
    "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300",
    "bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-300",
    "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300",
    "bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300",
    "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300",
    "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300"
  ];

  // Simple hash function for consistent color mapping
  let hash = 0;
  for (let i = 0; i < t.length; i++) {
    hash = t.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * 显示轻量提示（Toast）
 * @param {string} message 文本内容
 * @param {('info'|'success'|'error')} level 级别
 */
export function showToast(message = '', level = 'info') {
  try {
    const containerId = 'rune-toast-container';
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'fixed';
      container.style.top = '12px';
      container.style.right = '12px';
      container.style.zIndex = '9999';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '8px';
      document.body.appendChild(container);
    }

    const el = document.createElement('div');
    el.textContent = String(message || '').trim() || '提示';
    el.style.padding = '10px 14px';
    el.style.borderRadius = '8px';
    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
    el.style.color = '#fff';
    el.style.fontSize = '14px';
    el.style.fontWeight = '600';
    el.style.maxWidth = '380px';
    el.style.wordBreak = 'break-word';
    el.style.pointerEvents = 'auto';

    const colors = {
      info: '#4A69FF',
      success: '#10B981',
      error: '#EF4444',
    };
    el.style.background = colors[level] || colors.info;

    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0.0';
      el.style.transition = 'opacity 200ms ease';
      setTimeout(() => el.remove(), 220);
    }, 2600);
  } catch (e) {
    console.warn('Toast failed:', e);
    alert(message);
  }
}

/**
 * Fetch with timeout (Wrapper for fetch API)
 * @param {string} url Resource URL
 * @param {object} options fetch options
 * @param {number} timeoutMs default 4000ms
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Toggle button loading state
 * @param {HTMLButtonElement} btn 
 * @param {boolean} isLoading 
 * @param {string} [loadingText] 
 * @param {string} [originalText] 
 */
export function setBtnLoading(btn, isLoading, loadingText = 'Loading...', originalText = '') {
  if (!btn) return;
  if (isLoading) {
    if (!btn.dataset.originalText) {
      btn.dataset.originalText = originalText || btn.textContent;
    }
    btn.disabled = true;
    btn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      ${loadingText}
    `;
    btn.classList.add('opacity-75', 'cursor-not-allowed');
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || originalText || 'Submit';
    btn.classList.remove('opacity-75', 'cursor-not-allowed');
  }
}
