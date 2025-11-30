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
 * Build card icon HTML
 * @param {object} param0 { title, url }
 * @returns {string} HTML string
 */
export function buildIconHTML({ title = "", url = "" } = {}) {
  const initial = (title || url || "U").trim().charAt(0).toUpperCase() || "U";
  return `
    <div class="rune-card-icon w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center text-base font-bold">
      ${escapeHTML(initial)}
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
