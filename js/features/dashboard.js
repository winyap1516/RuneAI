import { $, $$, fadeIn, slideToggle, on, openModal, closeModal, show, hide, mountHTML, delegate, openConfirm, openTextPrompt } from "../utils/dom.js";
import { mockAIFromUrl as mockAIFromUrlExternal, mockFetchSiteContent as mockFetchSiteContentExternal } from "../../mockFunctions.js";
import storageAdapter from "../storage/storageAdapter.js";

// =============================
// 🎴 统一卡片模板与辅助函数
// =============================

// Safely escape HTML to prevent malicious script injection
function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Normalize URLs for comparison
function normalizeForCompare(raw = '') {
  const n = normalizeUrl(raw);
  if (!n) return '';
  try {
    const u = new URL(n);
    const path = String(u.pathname || '').replace(/\/+$/, '');
    return `${u.hostname.toLowerCase()}${path}`;
  } catch {
    return String(n).toLowerCase().replace(/\/+$/, '');
  }
}

// Check if a URL is subscribed
function isUrlSubscribed(url = '') {
  return storageAdapter.isSubscribed(url);
}

// Get Tailwind color classes based on tag keywords (Auto-color system)
function getTagClass(tag = "") {
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

// Unified button loading state toggle
function setLoading(btn, on, text = 'Processing…') {
  if (!btn) return;
  if (on) {
    btn.dataset.origText = btn.textContent || '';
    btn.innerHTML = `<span class="spinner"></span> ${escapeHTML(text)}`;
    btn.disabled = true;
  } else {
    btn.innerHTML = escapeHTML(btn.dataset.origText || btn.textContent || '');
    btn.disabled = false;
  }
}

// Build card icon
function buildIconHTML({ title = "", url = "" } = {}) {
  const initial = (title || url || "U").trim().charAt(0).toUpperCase() || "U";
  return `
    <div class="rune-card-icon w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center text-base font-bold">
      ${escapeHTML(initial)}
    </div>
  `;
}

// Unified card template
export function createCard(data = {}) {
  const { id = "", title = "Untitled", description = "AI-generated summary placeholder…", category = "", tags = [], url = "" } = data;
  const tagsHtml = (Array.isArray(tags) ? tags : []).map((raw) => {
    const label = String(raw).trim();
    const colorCls = getTagClass(label);
    // 确保样式符合要求：圆角 999px (rounded-full), 小字体 (text-xs), padding 4px 10px (px-2.5 py-1)
    return `<span class="rune-tag ${colorCls} rounded-full px-2.5 py-1 text-xs font-medium border border-transparent">${escapeHTML(label)}</span>`;
  }).join("");

  return `
    <div class="rune-card group rounded-xl border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-surface-dark p-3 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all" data-card-id="${escapeHTML(id)}" data-category="${escapeHTML(category)}">
      <div class="rune-card-head flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          ${buildIconHTML({ title, url })}
          <div class="rune-card-title text-base font-bold">${escapeHTML(title)}</div>
        </div>
        <button class="more-btn material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark" title="More">more_horiz</button>
        <div class="rune-card-menu absolute right-3 top-10 hidden rounded-lg bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 shadow-md z-50">
          <ul class="min-w-[140px] p-2 text-sm">
            <li><button class="menu-edit w-full text-left px-3 py-2">Edit</button></li>
            <li><button class="menu-unsubscribe hidden w-full text-left px-3 py-2">Unsubscribe</button></li>
            <li><button class="menu-delete w-full text-left px-3 py-2 text-red-600">Delete</button></li>
          </ul>
        </div>
      </div>
      <div class="rune-card-desc text-sm mt-2 text-text-secondary-light dark:text-text-secondary-dark">${escapeHTML(description)}</div>
      <div class="rune-card-divider my-3"></div>
      <div class="rune-card-tags flex flex-wrap gap-2">
        ${tagsHtml}
      </div>
      <div class="mt-3 card-actions flex items-center justify-end gap-2">
        ${(() => { const nurl = normalizeUrl(url); return `<button class\="btn-subscribe btn btn-small btn-muted\" data-url=\"${escapeHTML(nurl)}\">Subscribe</button>`; })()}
        <div class="card-controls" style="display:none;">
          <button class="btn-generate-once btn btn-small btn-outline" data-sub-id="">Generate Now</button>
        </div>
      </div>
    </div>
  `;
}

// =============================
// 💾 本地存储与数据模型（适配器模式）
// =============================

const RESERVED_CATEGORIES = new Set(['All Links']);

// Mark subscription button states
function markSubscribedButtons() {
  const subs = storageAdapter.getSubscriptions();
  const urls = new Set(
    subs
      .filter(s => s.enabled !== false)
      .map(s => normalizeUrl(s.url))
      .filter(u => !!u)
  );
  const container = document.getElementById('cardsContainer');
  if (!container) return;
  const btns = Array.from(container.querySelectorAll('.btn-subscribe'));
  btns.forEach((b) => {
    const url = normalizeUrl(b.getAttribute('data-url') || '');
    applySubscribeStyle(b, urls.has(url));
    const wrap = b.closest('.card-actions');
    if (!wrap) return;
    const controls = wrap.querySelector('.card-controls');
    const onceBtn = wrap.querySelector('.btn-generate-once');
    const card = b.closest('.rune-card');
    const menuUnsub = card?.querySelector('.menu-unsubscribe');
    const subsAll = storageAdapter.getSubscriptions();
    const sub = subsAll.find(s => s.enabled !== false && normalizeForCompare(s.url) === normalizeForCompare(url));
    const isOn = !!sub;
    if (controls) controls.style.display = isOn ? 'inline-flex' : 'none';
    if (onceBtn) { onceBtn.disabled = !isOn; onceBtn.dataset.subId = sub?.id || ''; }
    if (menuUnsub) { if (isOn) menuUnsub.classList.remove('hidden'); else menuUnsub.classList.add('hidden'); }
  });
  syncCardControlsVisibility();
}

function syncCardControlsVisibility() {
  const container = document.getElementById('cardsContainer');
  if (!container) return;
  Array.from(container.querySelectorAll('.rune-card')).forEach((card) => {
    const url = card.querySelector('.btn-subscribe')?.getAttribute('data-url') || '';
    const subscribed = isUrlSubscribed(url);
    const controls = card.querySelector('.card-controls');
    if (controls) controls.style.display = subscribed ? 'inline-flex' : 'none';
    const onceBtn = card.querySelector('.btn-generate-once');
    if (onceBtn) onceBtn.style.display = subscribed ? 'inline-flex' : 'none';
    const menuUnsub = card.querySelector('.menu-unsubscribe');
    if (menuUnsub) { if (subscribed) menuUnsub.classList.remove('hidden'); else menuUnsub.classList.add('hidden'); }
  });
}

function normalizeUrl(raw = '') {
  const s = String(raw).trim();
  if (!s) return '';
  const guess = /^(https?:)?\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(guess);
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return '';
  }
}

function findCardByUrl(url = '') {
  const target = String(url).trim();
  if (!target) return null;
  const cards = storageAdapter.getLinks();
  return cards.find(c => String(c.url).trim() === target) || null;
}

// =============================
// ☁️ 云端 AI 封装（Supabase Edge Functions）
// =============================
const SUPABASE_URL = (import.meta?.env?.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta?.env?.VITE_SUPABASE_ANON_KEY || '').trim();
const useCloud = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

async function fetchAIFromCloud(url) {
  const endpoint = `${SUPABASE_URL}/functions/v1/super-endpoint`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ url })
  });
  if (!res.ok) throw new Error(`Cloud AI failed: ${res.status}`);
  const data = await res.json();
  return data;
}

async function loadCloudLinks() {
  try {
    const endpoint = `${SUPABASE_URL}/rest/v1/links?select=*`;
    const res = await fetch(endpoint, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });
    if (!res.ok) throw new Error(`List failed: ${res.status}`);
    const arr = await res.json();
    return (Array.isArray(arr) ? arr : []).map(row => ({
      id: row.id, // Use ID from cloud
      url: row.url || '',
      title: row.title || 'Untitled',
      description: row.description || 'Summary from cloud',
      category: row.category || 'All Links',
      tags: Array.isArray(row.tags) ? row.tags : [],
      created_at: row.created_at || Date.now(),
      updated_at: row.updated_at || Date.now(),
    }));
  } catch (e) {
    console.warn(e);
    return [];
  }
}

function renderCategoriesSidebar() {
  const list = document.getElementById('linksGroupList');
  if (!list) return;
  list.innerHTML = '';
  const categories = storageAdapter.getCategories();

  const allItem = document.createElement('div');
  allItem.className = 'flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer';
  allItem.setAttribute('data-name', '');
  allItem.innerHTML = `<button class="category-filter text-sm font-medium text-left flex-1 w-full focus:outline-none" title="All Links" data-initial="All">All Links</button>`;
  list.appendChild(allItem);

  categories.forEach(cat => {
    if (!cat || cat === 'All Links') return;
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors relative group';
    item.setAttribute('data-name', cat);
    
    const safeName = String(cat).replace(/\s+/g, '-').toLowerCase();
    const menuId = `cat-menu-${safeName}`;
    const btnId = `cat-btn-${safeName}`;
    // Get first letter for avatar
    const initial = (cat || 'U').charAt(0).toUpperCase();

    item.innerHTML = `
      <button class="category-filter text-sm font-medium text-left flex-1 focus:outline-none truncate mr-2" title="${escapeHTML(cat)}" data-initial="${escapeHTML(initial)}">${escapeHTML(cat)}</button>
      <div class="relative shrink-0">
        <button id="${btnId}" class="category-more p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-text-secondary-light dark:text-text-secondary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors" aria-haspopup="true" aria-expanded="false" aria-controls="${menuId}" aria-label="Options">
          <span class="material-symbols-outlined text-base">more_horiz</span>
        </button>
        <div id="${menuId}" class="category-menu absolute right-0 top-8 hidden w-40 rounded-lg bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-hidden flex flex-col py-1" role="menu" aria-labelledby="${btnId}">
           <button class="w-full text-left px-4 py-2 text-sm text-gray-400 cursor-not-allowed bg-gray-50 dark:bg-white/5" disabled role="menuitem">Rename Category</button>
           <button class="category-delete w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 dark:focus:bg-red-900/20 focus:outline-none transition-colors" role="menuitem">Delete Category</button>
        </div>
      </div>
    `;
    list.appendChild(item);
  });
}

function syncEditCategorySelect() {
  const sel = document.getElementById('editLinkCategory');
  if (!sel) return;
  const categories = storageAdapter.getCategories();
  sel.innerHTML = '<option value="">Select Category</option>' + categories.filter(c => c !== 'All Links').map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('') + '<option value="__new__">+ New category…</option>';
}

export function initDashboard() {
  console.log("📊 Dashboard initialized");

  if (import.meta?.env?.DEV) {
    if (window.location.search.includes('selftest')) {
      (async () => {
        try {
          const url = normalizeUrl('example.com/selftest');
          let ai = null;
          if (useCloud) { try { ai = await fetchAIFromCloud(url); } catch { ai = null; } }
          const mock = ai || await mockAIFromUrlExternal(url);
          const data = {
            title: mock?.title || 'SelfTest',
            description: mock?.description || 'Integration test placeholder',
            category: mock?.category || 'All Links',
            tags: Array.isArray(mock?.tags) && mock.tags.length ? mock.tags : ['bookmark'],
            url,
          };
          const added = storageAdapter.addLink(data);
          console.log('✅ Self-test: add flow completed');
          storageAdapter.deleteLink(added.id);
          console.log('✅ Self-test: delete flow completed');
        } catch (e) {
          console.warn('❌ Self-test failed:', e);
        }
      })();
    }
  }

  const mainEl = document.querySelector('main');
  const defaultMainHTML = mainEl ? mainEl.innerHTML : '';

  const toggle = document.getElementById("sidebarToggle");
  const logoBtn = document.getElementById("logoBtn");
  const sidebar = document.querySelector(".sidebar");
  const mobileToggle = document.getElementById("mobileSidebarToggle");

  const toggleSidebar = (forceState) => {
    if (!sidebar) return;
    
    // If forceState is provided, use it. Otherwise toggle.
    // true = collapsed, false = expanded
    const isCollapsed = forceState !== undefined ? forceState : !sidebar.classList.contains("aside-collapsed");
    
    if (isCollapsed) {
      sidebar.classList.add("aside-collapsed");
      sidebar.setAttribute("aria-expanded", "false");
    } else {
      sidebar.classList.remove("aside-collapsed");
      sidebar.setAttribute("aria-expanded", "true");
    }
    
    // Save preference
    try {
      localStorage.setItem("sidebarCollapsed", isCollapsed);
    } catch {}
  };

  // Initialize state from localStorage
  try {
    const stored = localStorage.getItem("sidebarCollapsed");
    // Default to expanded (false) if not set. 
    // If stored is 'true', then collapse.
    // Mobile check: on mobile, default to hidden/expanded overlay? 
    // Current CSS handles mobile sidebar visibility differently (usually overlay).
    // But for the "collapse to icon" feature, user said: "在移动端（max-width <= 768px）折叠默认为展开（不要自动折叠成 logo-only）"
    // So we only apply stored preference if window width > 768
    if (window.innerWidth > 768 && stored === 'true') {
      toggleSidebar(true);
    }
  } catch {}

  if (logoBtn) {
    on(logoBtn, "click", (e) => {
      // If sidebar is collapsed, expand it.
      // If sidebar is expanded, collapse it.
      toggleSidebar(); 
    });
    // Keyboard support for logoBtn (Enter/Space handled by 'click' on button usually, but let's ensure)
    on(logoBtn, "keydown", (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSidebar();
      }
    });
  }

  if (toggle) {
    toggle.addEventListener("click", () => toggleSidebar());
  }
  
  if (mobileToggle && sidebar) {
     // Mobile menu toggle logic (often different from desktop collapse)
     // Existing logic might be missing for mobileSidebarToggle, let's add it.
     // Usually mobile toggle shows/hides the sidebar completely (transform translate).
     // But here we just focus on the collapse feature. 
     // If the user wants the mobile button to toggle the sidebar *visibility* (off-canvas), 
     // that's separate from "aside-collapsed".
     // Assuming existing CSS handles mobile visibility or we leave it as is for now.
     // The user prompt implies: "响应式：在移动端...折叠默认为展开...但仍允许用户手动折叠"
     // So maybe mobile toggle also toggles collapse? 
     // "click logo 展开/收起" applies.
     // Let's stick to the desktop collapse logic first.
  }

  const navGroups = [
    { header: "linksGroupHeader", body: "linksGroupBody" },
    { header: "subsGroupHeader", body: "subsGroupBody" },
    { header: "aiGroupHeader", body: "aiGroupBody" },
    { header: "userGroupHeader", body: "userGroupBody" },
  ];

  navGroups.forEach(({ header, body }) => {
    const h = document.getElementById(header);
    const b = document.getElementById(body);
    if (h && b) {
      // Initialize as open and visible (so menus can pop out)
      b.style.maxHeight = "none";
      b.style.overflow = "visible";
      
      // Setup icon rotation
      const icon = h.querySelector('.material-symbols-outlined');
      if (icon) {
         icon.style.transition = 'transform 0.2s ease';
         icon.style.transform = 'rotate(180deg)'; // Open = 180deg
      }
      
      // ARIA
      h.setAttribute('role', 'button');
      h.setAttribute('aria-expanded', 'true');
      h.setAttribute('aria-controls', body);

      h.addEventListener("click", (e) => {
        e.preventDefault();
        
        // Check current state based on maxHeight
        // If maxHeight is 'none' or non-zero, it's open.
        const isOpen = b.style.maxHeight !== '0px';
        
        if (isOpen) {
          // Closing
          // 1. Set explicit height for transition to work (from 'none' or 'auto')
          b.style.maxHeight = b.scrollHeight + "px";
          b.style.overflow = "hidden";
          
          // 2. Force reflow
          b.offsetHeight; 
          
          // 3. Set to 0
          b.style.transition = 'max-height 200ms ease-in-out';
          b.style.maxHeight = "0px";
          
          if (icon) icon.style.transform = 'rotate(0deg)';
          h.setAttribute('aria-expanded', 'false');
        } else {
          // Opening
          b.style.overflow = "hidden";
          b.style.transition = 'max-height 200ms ease-in-out';
          b.style.maxHeight = b.scrollHeight + "px";
          
          if (icon) icon.style.transform = 'rotate(180deg)';
          h.setAttribute('aria-expanded', 'true');
          
          // After transition, set overflow to visible so menus can show
          const onEnd = () => {
             if (b.style.maxHeight !== '0px') { // Still open
                 b.style.maxHeight = "none";
                 b.style.overflow = "visible";
             }
             b.removeEventListener('transitionend', onEnd);
          };
          b.addEventListener('transitionend', onEnd);
        }
      });
    }
  });

  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      navItems.forEach((i) => i.classList.remove("active-item"));
      item.classList.add("active-item");
    });
  });

  function renderDefaultMain() {
    if (mainEl) {
      mainEl.innerHTML = defaultMainHTML;
      try { seedDemoCards(); } catch {}
      markSubscribedButtons();
    }
  }

  function renderDigestView() {
    if (!mainEl) return;
    mountHTML(mainEl, `
      <section class="p-6">
        <div class="mb-4">
          <h1 class="text-2xl font-bold">AI Digest</h1>
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">Recent digests generated from subscriptions.</p>
        </div>
        <div class="mb-3">
          <button id="digestMockGenerate" class="h-9 px-3 rounded-lg bg-primary text-white text-sm font-semibold">Generate Today's Digest</button>
          <button id="digestRetryErrors" class="h-9 ml-2 px-3 rounded-lg bg-gray-100 dark:bg-white/10 text-sm">Retry Failed Subscriptions</button>
        </div>
        <div class="flex items-center gap-3 mb-3">
          <input id="digestDate" type="date" class="form-input rounded-lg bg-gray-100 dark:bg-white/5 border-none text-sm" />
          <select id="digestSub" class="form-select rounded-lg bg-gray-100 dark:bg-white/5 border-none text-sm"><option value="">All Subscriptions</option></select>
          <input id="digestSearch" placeholder="Search summaries/titles…" class="form-input rounded-lg bg-gray-100 dark:bg-white/5 border-none text-sm flex-1" />
        </div>
        <div id="digestList" class="digest-grid"></div>
      </section>
    `);
    const subs = storageAdapter.getSubscriptions();
    const sel = document.getElementById('digestSub');
    if (sel) {
      sel.innerHTML = '<option value="">All Subscriptions</option>' + subs.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.title||s.url)}</option>`).join('');
    }
    const listEl = document.getElementById('digestList');
    const dateEl = document.getElementById('digestDate');
    const mockBtn = document.getElementById('digestMockGenerate');
    const searchEl = document.getElementById('digestSearch');
    const render = () => {
      const all = storageAdapter.getDigests();
      const date = dateEl?.value || '';
      const siteId = sel?.value || '';
      const keyword = (searchEl?.value || '').trim().toLowerCase();
      const merged = all.filter(d => d && d.merged === true && (!date || d.date === date)).filter(d => {
        if (!siteId && !keyword) return true;
        const entries = Array.isArray(d.entries) ? d.entries : [];
        const bySite = !siteId || entries.some(e => e.subscriptionId === siteId);
        const byText = !keyword || entries.some(e => (e.title||'').toLowerCase().includes(keyword) || (e.summary||'').toLowerCase().includes(keyword));
        return bySite && byText;
      }).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      
      listEl.innerHTML = merged.length ? '' : '<div class="col-span-full text-sm text-text-secondary-light dark:text-text-secondary-dark">No digests yet</div>';
      
      merged.forEach(d => {
        const siteCount = Number(d.siteCount || (Array.isArray(d.entries)?d.entries.length:0));
        const entries = Array.isArray(d.entries) ? d.entries : [];
        const ts = d.updated_at || d.created_at || Date.now();
        const tsText = new Date(ts).toLocaleString();
        const card = document.createElement('div');
        card.className = 'digest-card bg-surface-light dark:bg-surface-dark rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer relative group flex flex-col h-full';
        card.setAttribute('data-digest-id', d.id);
        
        const maxSites = 5;
        const shownEntries = entries.slice(0, maxSites);
        const moreCount = entries.length > maxSites ? entries.length - maxSites : 0;

        card.innerHTML = `
          <div class="flex justify-between items-start mb-3">
            <div>
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
             ${shownEntries.map(e => {
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
             }).join('')}
             ${moreCount > 0 ? `<div class="text-xs text-text-secondary-light dark:text-text-secondary-dark pl-9">+${moreCount} more sites...</div>` : ''}
          </div>
          <div class="mt-3 flex items-center justify-end gap-3">
            <div class="text-xs text-text-secondary-light dark:text-text-secondary-dark">Generated at: ${escapeHTML(tsText)}</div>
            <button class="digest-view-btn btn btn-small btn-outline" data-id="${escapeHTML(d.id)}">
              <span class="material-symbols-outlined text-base">chevron_right</span> View Summary
            </button>
          </div>
        `;
        listEl.appendChild(card);
      });
    };
    render();
    if (dateEl) on(dateEl, 'change', render);
    if (sel) on(sel, 'change', render);
    if (searchEl) on(searchEl, 'input', render);
    if (mockBtn) on(mockBtn, 'click', async () => {
      const subsAll = storageAdapter.getSubscriptions().filter(s=>s.enabled!==false);
      const targetId = sel?.value || '';
      const targets = targetId ? subsAll.filter(s => s.id === targetId) : subsAll;
      if (!targets.length) {
        openTextPrompt({ title: 'Error', placeholder: 'No active subscriptions' });
        return;
      }
      try {
        const dateStr = new Date().toISOString().slice(0,10);
        const digests = storageAdapter.getDigests();
        let merged = digests.find(d => d.date === dateStr && d.merged === true);
        const newEntries = [];
        for (const s of targets) {
          const site = await mockFetchSiteContentExternal(s.url);
          const ai = await mockAIFromUrlExternal(s.url);
          newEntries.push({
            subscriptionId: s.id,
            url: normalizeUrl(s.url),
            title: ai.title || s.title || s.url,
            summary: ai.description || (site?.content||'').slice(0,500) || 'No summary',
            highlights: Array.isArray(ai.tags) ? ai.tags : [],
            raw: { site, ai }
          });
        }
        if (merged) {
          const exist = new Set((merged.entries||[]).map(e=>normalizeUrl(e.url)));
          for (const e of newEntries) { if (!exist.has(normalizeUrl(e.url))) (merged.entries||[]).push(e); }
          merged.entries = merged.entries || [];
          merged.siteCount = merged.entries.length;
          merged.updated_at = Date.now();
        } else {
          merged = {
            id: `digest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,
            date: dateStr,
            merged: true,
            title: `AI Digest · ${dateStr}`,
            siteCount: newEntries.length,
            entries: newEntries,
            created_at: Date.now()
          };
        }
        storageAdapter.addDigest(merged);
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-primary text-white text-sm shadow-lg';
        toast.textContent = `Merged digest generated (${merged.siteCount} sites)`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1600);
        render();
      } catch (e) { console.error(e); }
    });
    
    delegate(listEl, '.digest-delete', 'click', (e, btn) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (!id) return;
      openConfirm({
        title: 'Delete digest?',
        message: 'This action cannot be undone.',
        okText: 'Delete',
        onOk: () => {
          storageAdapter.deleteDigest(id);
          try {
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-red-500 text-white text-sm shadow-lg';
            toast.textContent = 'Deleted 1 digest';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 1600);
          } catch {}
          render();
        }
      });
    });
    
    delegate(listEl, '.digest-card', 'click', (e, card) => {
      if (e.target.closest('button')) return;
      
      const id = card.getAttribute('data-digest-id');
      const all = storageAdapter.getDigests();
      const d = all.find(x => x.id === id);
      if (!d) return;
      
      let panel = document.getElementById('digestDetailPanel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'digestDetailPanel';
        panel.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
        panel.innerHTML = `
          <div class="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-surface-light dark:bg-surface-dark shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
               <div>
                 <h3 class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark" id="digestDetailTitle"></h3>
                 <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1" id="digestDetailMeta"></p>
               </div>
               <div class="flex items-center gap-2">
                 <button id="digestDetailDownload" class="btn btn-small btn-outline">
                   <span class="material-symbols-outlined text-base">download</span> Download JSON
                 </button>
                 <button id="digestDetailClose" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-text-secondary-light transition-colors">
                   <span class="material-symbols-outlined">close</span>
                 </button>
               </div>
            </div>
            <div id="digestDetailEntries" class="flex-1 overflow-y-auto p-6 flex flex-col gap-4"></div>
          </div>`;
        document.body.appendChild(panel);
      }
      
      const t = document.getElementById('digestDetailTitle');
      const m = document.getElementById('digestDetailMeta');
      const dlBtn = document.getElementById('digestDetailDownload');
      
      if (t) t.textContent = `${d.title}`;
      if (m) m.textContent = `${d.date} · ${Number(d.siteCount|| (Array.isArray(d.entries)?d.entries.length:0))} sites · ID: ${d.id}`;
      
      if (dlBtn) {
        const newBtn = dlBtn.cloneNode(true);
        dlBtn.parentNode.replaceChild(newBtn, dlBtn);
        newBtn.onclick = () => {
             const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
             const url = URL.createObjectURL(blob);
             const a = document.createElement('a');
             a.href = url; a.download = `digest_${d.date}.json`; a.click();
             URL.revokeObjectURL(url);
        };
      }

      const container = document.getElementById('digestDetailEntries');
      if (container) {
        container.innerHTML = '';
        const entries = Array.isArray(d.entries) ? d.entries : [];
        if (entries.length === 0) {
           container.innerHTML = '<div class="text-center text-gray-400 py-10">No content</div>';
        }
        entries.forEach((e, idx) => {
          const block = document.createElement('div');
          block.className = 'rounded-xl p-5 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800';
          block.innerHTML = `
            <div class="flex items-start justify-between gap-3 mb-2">
               <div class="font-bold text-base text-text-primary-light dark:text-text-primary-dark">${escapeHTML(e.title || e.url)}</div>
               <a href="${escapeHTML(e.url)}" target="_blank" class="text-primary hover:underline text-xs shrink-0">Open link ↗</a>
            </div>
            <div class="text-sm text-text-secondary-light dark:text-text-secondary-dark leading-relaxed mb-3">${escapeHTML(e.summary || 'No summary')}</div>
            <div class="flex flex-wrap gap-2">
               ${(Array.isArray(e.highlights)?e.highlights:[]).map(h=>`<span class='rune-tag bg-white dark:bg-white/10 border border-gray-200 dark:border-transparent text-xs'>${escapeHTML(h)}</span>`).join('')}
            </div>
          `;
          container.appendChild(block);
        });
      }
      
      show(panel);
      
      const closeBtn = document.getElementById('digestDetailClose');
      if (closeBtn) {
          const newClose = closeBtn.cloneNode(true);
          closeBtn.parentNode.replaceChild(newClose, closeBtn);
          newClose.onclick = () => hide(panel);
      }
      
      panel.onclick = (ev) => {
          if (ev.target === panel) hide(panel);
      };
    });

    delegate(listEl, '.digest-view-btn', 'click', (e, btn) => {
      e.preventDefault(); e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const all = storageAdapter.getDigests();
      const d = all.find(x => x.id === id);
      if (!d) return;
      const card = btn.closest('.digest-card');
      if (card) {
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        card.dispatchEvent(evt);
      }
    });
  }
  function renderChatView() {
    if (!mainEl) return;
    mountHTML(mainEl, `
      <section class="p-6">
        <div class="mb-4">
          <h1 class="text-2xl font-bold">Chat / AI Assistant</h1>
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">Chat with AI (placeholder).</p>
        </div>
        <div class="flex gap-2">
          <input id="chatInput" class="form-input flex-1 rounded-lg bg-gray-100 dark:bg-white/5 border-none" placeholder="Type a message…" />
          <button id="chatSend" class="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold">Send</button>
        </div>
        <div id="chatList" class="mt-4 flex flex-col gap-2"></div>
      </section>
    `);
    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');
    const chatList = document.getElementById('chatList');
    if (chatSend && chatInput && chatList) {
      on(chatSend, 'click', () => {
        const text = chatInput.value.trim();
        if (!text) return;
        const me = document.createElement('div');
        me.className = 'text-sm';
        me.textContent = `You: ${text}`;
        const ai = document.createElement('div');
        ai.className = 'text-sm text-text-secondary-light dark:text-text-secondary-dark';
        ai.textContent = 'AI: Placeholder reply';
        chatList.append(me, ai);
        chatInput.value = '';
      });
    }
  }
  const navDigest = document.getElementById('navDigest');
  const navChat = document.getElementById('navChat');
  const navSettings = document.getElementById('navSettings');
  if (navDigest) on(navDigest, 'click', (e) => { e.preventDefault(); renderDigestView(); });
  if (navChat) on(navChat, 'click', (e) => { e.preventDefault(); renderChatView(); });
  if (navSettings) on(navSettings, 'click', (e) => {
    e.preventDefault();
    const backdrop = document.getElementById('modalBackdrop');
    const container = document.getElementById('settingsModalContainer');
    if (!container) return;
    let panel = document.getElementById('settingsPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'settingsPanel';
      panel.className = 'fixed inset-0 z-50 flex items-center justify-center';
      panel.innerHTML = `
        <div class="rounded-xl bg-white dark:bg-surface-dark shadow-xl p-5 w-full max-w-lg">
          <h3 class="text-lg font-bold mb-3">Settings</h3>
          <div class="grid grid-cols-1 gap-3">
            <label class="text-sm">Theme
              <select class="form-select mt-1 w-full rounded-lg bg-gray-100 dark:bg-white/5 border-none">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label class="text-sm">Email notification
              <input type="checkbox" class="form-checkbox ml-2" />
            </label>
          </div>
          <div class="mt-4">
            <h4 class="text-base font-semibold mb-2">Subscription settings</h4>
            <div id="subsSettingsList" class="space-y-2"></div>
          </div>
          <div class="mt-5 flex justify-end gap-3">
            <button id="settingsCloseBtn" class="h-10 px-4 rounded-lg bg-gray-100 dark:bg-white/10 text-sm font-semibold">Close</button>
          </div>
        </div>`;
      container.appendChild(panel);
    }
    show(backdrop);
    show(panel);
    try { if (typeof window.renderSubscriptionsSettings === 'function') window.renderSubscriptionsSettings(); } catch {}
    const closeBtn = document.getElementById('settingsCloseBtn');
    if (closeBtn) on(closeBtn, 'click', () => { hide(panel); hide(backdrop); });
    on(backdrop, 'click', () => { hide(panel); hide(backdrop); });
  });

  const headerButtons = Array.from(document.querySelectorAll('header button'));
  const notifyBtn = headerButtons.find((btn) => btn.querySelector('.material-symbols-outlined')?.textContent?.trim() === 'notifications');
  if (notifyBtn) {
    on(notifyBtn, 'click', () => {
      let panel = document.getElementById('notifPanel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'notifPanel';
        panel.className = 'notify-panel';
        panel.innerHTML = `
          <div class="p-4">
            <h4 class="text-sm font-bold mb-2">Recent notifications</h4>
            <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">No notifications</p>
            <div class="mt-3 text-right">
              <button id="notifCloseBtn" class="text-xs text-text-secondary-light dark:text-text-secondary-dark">Close</button>
            </div>
          </div>`;
        document.body.appendChild(panel);
        const rect = notifyBtn.getBoundingClientRect();
        panel.style.position = 'fixed';
        panel.style.top = `${rect.bottom + 8}px`;
        panel.style.right = '16px';
        show(panel);
        const closeBtn = panel.querySelector('#notifCloseBtn');
        on(closeBtn, 'click', (ev) => { ev.preventDefault(); ev.stopPropagation(); hide(panel); });
        const onDocClick = (e) => {
          if (!panel.contains(e.target) && e.target !== notifyBtn) {
            hide(panel);
            document.removeEventListener('click', onDocClick);
          }
        };
        setTimeout(() => document.addEventListener('click', onDocClick), 0);
      } else {
        if (panel.style.display === 'none' || !panel.style.display) { show(panel); } else { hide(panel); }
      }
    });
  }

  const card = document.getElementById("userWelcomeCard");
  if (card) {
    card.innerHTML = `
      <div class="user-welcome-card">
        <h2 class="text-lg font-bold mb-1">Good evening, <span class="text-primary">SoloDev</span> 👋</h2>
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">A night full of inspiration.</p>
      </div>`;
  }

  const addLinkBtn = document.getElementById('addLinkBtn');
  const addLinkModal = document.getElementById('addLinkModal');
  const cancelAddLinkBtn = document.getElementById('cancelAddLinkBtn');
  const saveLinkBtn = document.getElementById('saveLinkBtn');
  const closeModalX = document.getElementById('closeModalX');
  const inpUrl = document.getElementById('inpUrl');
  const cardsContainer = document.getElementById('cardsContainer');

  if (addLinkBtn && addLinkModal) {
    on(addLinkBtn, 'click', () => {
      if (inpUrl) inpUrl.value = '';
      openModal(addLinkModal);
    });
  }
  if (cancelAddLinkBtn && addLinkModal) {
    on(cancelAddLinkBtn, 'click', () => closeModal(addLinkModal));
  }
  if (closeModalX && addLinkModal) {
    on(closeModalX, 'click', () => closeModal(addLinkModal));
  }
  if (saveLinkBtn && addLinkModal && inpUrl && cardsContainer) {
    on(saveLinkBtn, 'click', async () => {
      const raw = (inpUrl.value || '').trim();
      if (!raw) { openTextPrompt({ title: 'Error', placeholder: 'Please enter a valid URL' }); return; }
      const normalized = normalizeUrl(raw);
      if (!normalized) {
        openTextPrompt({ title: 'Error', placeholder: 'Please enter a valid URL' });
        return;
      }
      const exists = findCardByUrl(normalized);
      if (exists) {
        openTextPrompt({ title: 'Notice', placeholder: 'This link already exists.' });
        return;
      }
      setLoading(saveLinkBtn, true, 'Generating summary…');
      let ai = null;
      if (useCloud) {
        try { ai = await fetchAIFromCloud(normalized); } catch { ai = null; }
      }
      const mock = ai || await mockAIFromUrlExternal(normalized).catch(() => ({ title: '', description: '', category: 'All Links', tags: ['bookmark'] }));
      const data = {
        title: mock?.title || (normalized.replace(/^https?:\/\//, '').split('/')[0] || 'Untitled'),
        description: mock?.description || 'Mock: Auto-generated summary placeholder.',
        category: mock?.category || 'All Links',
        tags: Array.isArray(mock?.tags) && mock.tags.length ? mock.tags : ['bookmark'],
        url: normalized,
      };
      const added = storageAdapter.addLink(data);
      const html = createCard(added);
      cardsContainer.insertAdjacentHTML('afterbegin', html);
      markSubscribedButtons();
      inpUrl.value = '';
      closeModal(addLinkModal);
      setLoading(saveLinkBtn, false);
    });
  }

  const searchInput = document.getElementById('searchInput');
  function filterCards(query) {
    const q = (query || '').trim().toLowerCase();
    const cards = cardsContainer ? Array.from(cardsContainer.children) : [];
    let visibleCount = 0;
    cards.forEach((cardEl) => {
      const text = cardEl.textContent.toLowerCase();
      const match = !q || text.includes(q);
      cardEl.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });
    let emptyEl = document.getElementById('emptyState');
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.id = 'emptyState';
      emptyEl.className = 'text-sm text-text-secondary-light dark:text-text-secondary-dark mt-4';
      emptyEl.textContent = 'No matching links found';
      emptyEl.style.display = 'none';
      cardsContainer?.after(emptyEl);
    }
    emptyEl.style.display = visibleCount === 0 ? '' : 'none';
  }
  if (searchInput) {
    on(searchInput, 'input', (e) => filterCards(e.target.value));
    on(searchInput, 'keydown', (e) => {
      if (e.key === 'Enter') filterCards(searchInput.value);
    });
  }

  loadUserWelcome();

  function seedDemoCards() {
    const container = document.getElementById('cardsContainer');
    if (!container) return;
    const cards = storageAdapter.getLinks();
    if (cards.length > 0) {
      container.innerHTML = '';
      cards.forEach(c => {
        const html = createCard(c);
        container.insertAdjacentHTML('beforeend', html);
      });
      renderCategoriesSidebar();
      syncEditCategorySelect();
      return;
    }
    if (useCloud) {
      (async () => {
        const cloud = await loadCloudLinks();
      if (cloud.length > 0) {
        container.innerHTML = '';
        cloud.forEach(c => {
          const html = createCard(c);
          container.insertAdjacentHTML('beforeend', html);
          if (!findCardByUrl(c.url)) storageAdapter.addLink(c);
          storageAdapter.ensureCategory(c.category);
        });
        renderCategoriesSidebar();
        syncEditCategorySelect();
        markSubscribedButtons();
        return;
      }
        injectSamples();
      })();
      return;
    }
    injectSamples();
    function injectSamples() {
      const samples = [
      {
        title: 'Figma — Design tool',
        description: 'AI Summary: Figma is a modern design collaboration platform for prototyping and UI design.',
        category: 'Design',
        tags: ['Design', 'Productivity'],
        url: 'https://figma.com/',
      },
      {
        title: 'OpenAI — GPT Models',
        description: 'AI Summary: OpenAI provides advanced large language models and API access.',
        category: 'AI',
        tags: ['AI', 'Research'],
        url: 'https://openai.com/',
      },
      {
        title: 'GitHub — Code hosting',
        description: 'AI Summary: GitHub is a mainstream code hosting and collaboration platform.',
        category: 'Development',
        tags: ['Development'],
        url: 'https://github.com/',
      },
    ];
      samples.forEach((data) => {
        const added = storageAdapter.addLink(data);
        const html = createCard(added);
        container.insertAdjacentHTML('beforeend', html);
      });
      renderCategoriesSidebar();
      syncEditCategorySelect();
      markSubscribedButtons();
    }
  }
  seedDemoCards();

  const handleSubscribe = (e, btn) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    const url = normalizeUrl(btn.getAttribute('data-url') || '');
    if (!url) return;
    setLoading(btn, true, 'Processing…');
    
    const cards = storageAdapter.getLinks();
    const link = cards.find(c => normalizeForCompare(c.url) === normalizeForCompare(url));
    
    if (link) {
      storageAdapter.subscribe(link.id);
    } else {
       // 理论上不应该发生，因为 subscribe 按钮在卡片上
       console.error('Link not found for subscription');
    }
    
    setLoading(btn, false);
    const nowEnabled = isUrlSubscribed(url);
    applySubscribeStyle(btn, nowEnabled);
    markSubscribedButtons();
  };

  function registerCardEvents() {
    if (document.body.dataset.cardEventsBound === '1') return;
    document.body.dataset.cardEventsBound = '1';
    delegate(document, '.btn-subscribe', 'click', handleSubscribe);
    
    const freqModal = document.getElementById('freqModal');
    const freqSelect = document.getElementById('freqSelect');
    const freqOk = document.getElementById('freqOk');
    const freqCancel = document.getElementById('freqCancel');
    let __freqEditingSubId = null;
    function openFreqModal(subId) {
      __freqEditingSubId = subId;
      const subs = storageAdapter.getSubscriptions();
      const sub = subs.find(s => s.id === subId) || {};
      if (freqSelect) freqSelect.value = sub.frequency || 'daily';
      freqModal?.classList.remove('hidden');
    }
    function closeFreqModal() { __freqEditingSubId = null; freqModal?.classList.add('hidden'); }
    if (freqCancel) freqCancel.addEventListener('click', () => closeFreqModal());
    if (freqOk) freqOk.addEventListener('click', () => {
      if (!__freqEditingSubId) { closeFreqModal(); return; }
      const val = freqSelect?.value || 'daily';
      const subs = storageAdapter.getSubscriptions();
      const idx = subs.findIndex(s => s.id === __freqEditingSubId);
      if (idx !== -1) {
        storageAdapter.updateSubscription({ ...subs[idx], frequency: val, lastChecked: subs[idx].lastChecked || 0 });
      }
      markSubscribedButtons();
      closeFreqModal();
    });

    delegate(document, '.btn-generate-once', 'click', async (e, b) => {
      e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      const subId = b.getAttribute('data-sub-id') || '';
      const subs = storageAdapter.getSubscriptions().filter(s=>s.enabled!==false);
      const target = subs.find(s => s.id === subId);
      if (!target) return;
      setLoading(b, true, 'Generating…');
      try {
        const site = await mockFetchSiteContentExternal(target.url);
        const ai = await mockAIFromUrlExternal(target.url);
        const eobj = { subscriptionId: target.id, url: normalizeUrl(target.url), title: ai.title || target.title || target.url, summary: ai.description || (site?.content||'').slice(0,500) || 'No summary', highlights: Array.isArray(ai.tags)?ai.tags:[], raw: { site, ai } };
        const dateStr = new Date().toISOString().slice(0,10);
        const digests = storageAdapter.getDigests();
        let merged = digests.find(d => d.date === dateStr && d.merged === true);
        if (merged) {
          const exist = new Set((merged.entries||[]).map(x=>normalizeUrl(x.url)));
          if (!exist.has(eobj.url)) (merged.entries||[]).push(eobj);
          merged.entries = merged.entries || [];
          merged.siteCount = merged.entries.length; merged.updated_at = Date.now();
        } else {
          merged = { id: `digest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`, date: dateStr, merged: true, title: `AI Digest · ${dateStr}`, siteCount: 1, entries: [eobj], created_at: Date.now() };
        }
        storageAdapter.addDigest(merged);
        const t = document.createElement('div'); t.className='fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-primary text-white text-sm shadow-lg'; t.textContent='Digest generated successfully!'; document.body.appendChild(t); setTimeout(()=>t.remove(),1600);
      } catch { console.error('Generation failed'); }
      setLoading(b, false);
    });
  }

  if (cardsContainer) {
    if (!document.body.dataset.subsObserverBound) {
      const obs = new MutationObserver(() => { try { markSubscribedButtons(); } catch {} });
      obs.observe(cardsContainer, { childList: true, subtree: false });
      document.body.dataset.subsObserverBound = '1';
    }
    registerCardEvents();
    const closeAllMenus = () => {
      const menus = cardsContainer.querySelectorAll('.rune-card-menu');
      menus.forEach(m => m.classList.add('hidden'));
    };

    const closeAllMenusDoc = () => {
      const menus = document.querySelectorAll('.rune-card-menu');
      menus.forEach(m => m.classList.add('hidden'));
    };
    delegate(document, '.more-btn', 'click', (e, btn) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeUserDropdown();
      closeAllMenusDoc();
      const card = btn.closest('.rune-card');
      const menu = card?.querySelector('.rune-card-menu');
      if (menu) {
        menu.classList.toggle('hidden');
        if (!menu.classList.contains('hidden')) {
          try { document.body.dataset.menuOpen = '1'; } catch {}
        } else {
          try { delete document.body.dataset.menuOpen; } catch {}
        }
        const onDocClick = (ev) => {
          if (!card.contains(ev.target)) { menu.classList.add('hidden'); document.removeEventListener('click', onDocClick); }
          try { delete document.body.dataset.menuOpen; } catch {}
        };
        setTimeout(() => document.addEventListener('click', onDocClick), 0);
        const onEsc = (ev) => { if (ev.key === 'Escape') { menu.classList.add('hidden'); document.removeEventListener('keydown', onEsc); } };
        document.addEventListener('keydown', onEsc, { once: true });
      }
    });

    delegate(document, '.menu-edit', 'click', (e, btn) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeUserDropdown();
      const cardEl = btn.closest('.rune-card');
      const id = cardEl?.getAttribute('data-card-id');
      const cards = storageAdapter.getLinks();
      const data = id ? cards.find(c => c.id === id) : null;
      const modal = document.getElementById('editLinkModal');
      if (!data || !modal) return;
      const fTitle = document.getElementById('editLinkTitle');
      const fURL = document.getElementById('editLinkURL');
      const fDesc = document.getElementById('editLinkDesc');
      const fTags = document.getElementById('editLinkTags');
      const fCat = document.getElementById('editLinkCategory');
      const fCatNew = document.getElementById('editLinkCategoryNew');
      if (fTitle) fTitle.value = data.title || '';
      if (fURL) fURL.value = data.url || '';
      if (fDesc) fDesc.value = data.description || '';
      if (fTags) fTags.value = Array.isArray(data.tags) ? data.tags.join(',') : '';
      syncEditCategorySelect();
      if (fCat) fCat.value = data.category || '';
      if (fCatNew) { fCatNew.value = ''; fCatNew.classList.add('hidden'); }
      openModal(modal);
      const form = document.getElementById('editLinkForm');
      const cancelBtn = document.getElementById('cancelEditBtn');
      const menu = cardEl.querySelector('.rune-card-menu');
      const onSubmit = (ev) => {
        ev.preventDefault();
        const title = fTitle?.value?.trim() || 'Untitled';
        const url = fURL?.value?.trim() || '';
        const description = fDesc?.value?.trim() || '';
        const tagsStr = fTags?.value?.trim() || '';
        const catVal = fCat?.value || '';
        const newCat = fCatNew?.value?.trim() || '';
        const category = catVal === '__new__' ? (newCat || '') : catVal;
        if (!url) { openTextPrompt({ title: 'Error', placeholder: 'URL cannot be empty' }); return; }
        const tags = tagsStr ? tagsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        
        storageAdapter.updateLink(id, { title, url, description, tags, category });
        
        if (useCloud) {
          (async () => {
            try {
              const endpoint = `${SUPABASE_URL}/functions/v1/update-link`;
              const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                body: JSON.stringify({ url, title, description, category, tags })
              });
              if (!res.ok) throw new Error(`Update failed: ${res.status}`);
            } catch (err) {
              console.error(err);
            }
          })();
        }
        const updated = storageAdapter.getLinks().find(c => c.id === id);
        if (updated && cardEl) {
          cardEl.style.transition = 'opacity 120ms ease';
          cardEl.style.opacity = '0.4';
          cardEl.outerHTML = createCard(updated);
        }
        if (menu) menu.classList.add('hidden');
        closeModal(modal);
        form?.removeEventListener('submit', onSubmit);
        cancelBtn?.removeEventListener('click', onCancel);
      };
      const onCancel = () => {
        closeModal(modal);
        form?.removeEventListener('submit', onSubmit);
        cancelBtn?.removeEventListener('click', onCancel);
      };
      form?.addEventListener('submit', onSubmit);
      cancelBtn?.addEventListener('click', onCancel);
      if (fCat) {
        const onChange = () => {
          if (fCat.value === '__new__') fCatNew?.classList.remove('hidden');
          else fCatNew?.classList.add('hidden');
        };
        fCat.removeEventListener('change', onChange);
        fCat.addEventListener('change', onChange);
      }
    });

    delegate(document, '.menu-delete', 'click', (e, btn) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeUserDropdown();
      const cardEl = btn.closest('.rune-card');
      const id = cardEl?.getAttribute('data-card-id');
      if (!id) return;
      const cards = storageAdapter.getLinks();
      const data = cards.find(c => c.id === id);
      const menu = cardEl.querySelector('.rune-card-menu');
      openConfirm({
        title: `Delete saved link "${escapeHTML(data?.title || (data?.url||'').replace(/^https?:\/\//,''))}"?`,
        message: 'This will remove the link and its related digest entries.',
        okText: 'Delete',
        onOk: () => {
          cardEl.style.transition = 'opacity 160ms ease';
          cardEl.style.opacity = '0';
          setTimeout(() => { cardEl.remove(); }, 180);
          storageAdapter.deleteLink(id);

          if (useCloud && data?.url) {
            (async () => {
              try {
                const endpoint = `${SUPABASE_URL}/functions/v1/delete-link`;
                const res = await fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                  body: JSON.stringify({ url: data.url })
                });
                if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
              } catch (err) {
                console.error(err);
              }
            })();
          }
          if (menu) menu.classList.add('hidden');
        }
      });
    });

    delegate(document, '.menu-unsubscribe', 'click', (e, btn) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeUserDropdown();
      const cardEl = btn.closest('.rune-card');
      const id = cardEl?.getAttribute('data-card-id');
      if (!id) return;
      const cards = storageAdapter.getLinks();
      const data = cards.find(c => c.id === id);
      const titleText = data?.title || (data?.url||'').replace(/^https?:\/\//,'');
      
      openConfirm({
        title: `Unsubscribe from "${escapeHTML(titleText)}"?`,
        message: 'You will no longer receive AI digests for this site.',
        okDanger: true,
        okText: 'Unsubscribe',
        onOk: () => {
          storageAdapter.unsubscribe(id);
          const btnSub = cardEl?.querySelector('.btn-subscribe');
          applySubscribeStyle(btnSub, false);
          const controls = cardEl?.querySelector('.card-controls');
          if (controls) controls.style.display = 'none';
          const menu = cardEl?.querySelector('.rune-card-menu');
          if (menu) menu.classList.add('hidden');
        }
      });
    });
  }

  const dropdownContainer = document.getElementById('userDropdownContainer');
  if (dropdownContainer) {
    let menu = dropdownContainer.querySelector('.user-dropdown');
    if (!menu) {
      menu = document.createElement('div');
      menu.className = 'user-dropdown';
      menu.innerHTML = `
        <ul class="p-2">
          <li><button id="profileBtn" class="w-full text-left px-3 py-2 text-sm">Profile</button></li>
          <li><button id="settingsBtn" class="w-full text-left px-3 py-2 text-sm">Settings</button></li>
          <li><button id="logoutBtn" class="w-full text-left px-3 py-2 text-sm">Log out</button></li>
        </ul>`;
      dropdownContainer.appendChild(menu);
    }
    const avatar = dropdownContainer.querySelector('.user-avatar');
    if (avatar) {
      on(avatar, 'click', (e) => {
        e.stopPropagation();
        if (document.body.dataset.modalOpen === '1' || document.body.dataset.menuOpen === '1') return;
        menu.classList.toggle('show');
      });
      const onDocClick = (e) => {
        if (!dropdownContainer.contains(e.target)) {
          menu.classList.remove('show');
        }
      };
      document.addEventListener('click', onDocClick);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') menu.classList.remove('show');
      });
      const settingsBtn = document.getElementById('settingsBtn');
      if (settingsBtn) on(settingsBtn, 'click', () => {
        const navSettings = document.getElementById('navSettings');
        menu.classList.remove('show');
        navSettings?.click();
      });
    }
  }

  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const addCategoryModal = document.getElementById('addCategoryModal');
  const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');
  const saveCategoryBtn = document.getElementById('saveCategoryBtn');
  const closeCategoryX = document.getElementById('closeCategoryX');
  const inpCategoryName = document.getElementById('inpCategoryName');
  const linksGroupList = document.getElementById('linksGroupList');

  if (addCategoryBtn && addCategoryModal) {
    on(addCategoryBtn, 'click', () => openModal(addCategoryModal));
  }
  if (cancelCategoryBtn && addCategoryModal) {
    on(cancelCategoryBtn, 'click', () => closeModal(addCategoryModal));
  }
  if (closeCategoryX && addCategoryModal) {
    on(closeCategoryX, 'click', () => closeModal(addCategoryModal));
  }
  if (saveCategoryBtn && addCategoryModal && inpCategoryName && linksGroupList) {
    on(saveCategoryBtn, 'click', () => {
      const name = inpCategoryName.value.trim();
      if (!name) { openTextPrompt({ title: 'Error', placeholder: 'Please enter a category name' }); return; }
      storageAdapter.ensureCategory(name);
      inpCategoryName.value = '';
      closeModal(addCategoryModal);
      renderCategoriesSidebar();
      syncEditCategorySelect();
    });
  }
  if (linksGroupList) {
    delegate(linksGroupList, '.category-filter', 'click', (e, btn) => {
      const name = btn?.closest('div')?.getAttribute('data-name') || '';
      let container = document.getElementById('cardsContainer');
      if (!container) {
        renderDefaultMain();
        container = document.getElementById('cardsContainer');
      }
      const cardsEls = container ? Array.from(container.children) : [];
      let visibleCount = 0;
      cardsEls.forEach((el) => {
        const match = !name || el.getAttribute('data-category') === name;
        el.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });
      let emptyEl = document.getElementById('emptyState');
      if (!emptyEl) {
        emptyEl = document.createElement('div');
        emptyEl.id = 'emptyState';
        emptyEl.className = 'text-sm text-text-secondary-light dark:text-text-secondary-dark mt-4';
        emptyEl.textContent = 'No links in this category';
        emptyEl.style.display = 'none';
        container?.after(emptyEl);
      }
      emptyEl.style.display = visibleCount === 0 ? '' : 'none';
    });
    delegate(linksGroupList, '.category-more', 'click', (e, btn) => {
      e.preventDefault(); e.stopPropagation();
      console.log('menu click', btn.id); // Debug log requested by user
      
      const menu = btn.nextElementSibling;
      if (!menu) {
         console.error('Menu element not found for', btn);
         return;
      }

      const isHidden = menu.classList.contains('hidden');
      
      // Close all other open menus
      linksGroupList.querySelectorAll('.category-menu').forEach(m => {
        if (m !== menu && !m.classList.contains('hidden')) {
          m.classList.add('hidden');
          // Update aria-expanded for others
          const otherBtn = m.previousElementSibling;
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Toggle current menu
      if (isHidden) {
        menu.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
        
        // Position menu fixed if needed (e.g. sidebar collapsed or near edge)
        // Reset style first
        menu.style.position = ''; 
        menu.style.top = '';
        menu.style.left = '';
        menu.style.width = '';

        const sidebar = document.querySelector('.sidebar');
        const isCollapsed = sidebar && sidebar.classList.contains('aside-collapsed');
        
        if (isCollapsed) {
           const rect = btn.getBoundingClientRect();
           menu.style.position = 'fixed';
           menu.style.top = `${rect.top}px`;
           menu.style.left = `${rect.right + 10}px`;
           menu.style.width = '160px'; // w-40
           menu.style.zIndex = '100'; // higher z-index
        }
      } else {
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
      }

      // Close on outside click
      const onDocClick = (ev) => {
        if (!btn.contains(ev.target) && !menu.contains(ev.target)) {
          menu.classList.add('hidden');
          btn.setAttribute('aria-expanded', 'false');
          document.removeEventListener('click', onDocClick);
        }
      };
      
      // Use setTimeout to avoid immediate triggering
      setTimeout(() => document.addEventListener('click', onDocClick), 0);
    });

    delegate(linksGroupList, '.category-delete', 'click', (e, btn) => {
      e.preventDefault(); e.stopPropagation();
      
      const item = btn.closest('[data-name]');
      const name = item?.getAttribute('data-name') || '';
      const menu = btn.closest('.category-menu');
      
      // Hide menu immediately
      if (menu) {
        menu.classList.add('hidden');
        const triggerBtn = menu.previousElementSibling;
        if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'false');
      }

      if (!name || RESERVED_CATEGORIES.has(name)) {
        console.warn('Attempted to delete invalid or reserved category:', name);
        return;
      }

      openConfirm({
        title: `Delete category "${escapeHTML(name)}"?`,
        message: 'This will remove the category, but the links inside will remain available under All Links.',
        okText: 'Delete',
        okDanger: true,
        onOk: () => {
          // 1. Delete category from storage
          storageAdapter.deleteCategory(name);
          
          // 2. Update links belonging to this category
          const links = storageAdapter.getLinks();
          let changed = false;
          links.forEach(l => {
            if (l.category === name) {
               l.category = 'All Links';
               changed = true;
            }
          });
          if (changed) storageAdapter.saveLinks(links);

          // 3. Update UI
          renderCategoriesSidebar();
          syncEditCategorySelect();
          
          // 4. Switch view to All Links
          const allLinksBtn = linksGroupList.querySelector('[data-name=""] .category-filter');
          if (allLinksBtn) {
            allLinksBtn.click();
          } else {
            renderDefaultMain();
          }
          
          // Show success toast
          try {
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-gray-800 text-white text-sm shadow-lg';
            toast.textContent = `Category "${name}" deleted`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
          } catch {}
        }
      });
    });
  }
}

function loadUserWelcome() {
  const card = document.getElementById("userWelcomeCard");
  if (card) {
    card.innerHTML = `
      <div class="user-welcome-card">
        <h2 class="text-lg font-bold mb-1">Good evening, <span class="text-primary">SoloDev</span> 👋</h2>
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">A night full of inspiration.</p>
      </div>`;
  }

  const avatarContainer = document.getElementById("userDropdownContainer");
  if (avatarContainer) {
    avatarContainer.innerHTML = `
      <img src="https://i.pravatar.cc/100?u=solodev" alt="User Avatar"
        class="user-avatar" title="SoloDev" />`;
  }
}

// Auto-execution logic removed to prevent double initialization since main.js calls initDashboard
// if (document.readyState === "loading") {
//   window.addEventListener("DOMContentLoaded", initDashboard);
// } else {
//   initDashboard();
// }

function closeUserDropdown() {
  try {
    const ctn = document.getElementById('userDropdownContainer');
    const dd = ctn?.querySelector('.user-dropdown');
    dd?.classList.remove('show');
  } catch {}
}

function applySubscribeStyle(btn, subscribed) {
  if (!btn) return;
  btn.classList.remove('btn-primary','btn-muted','btn-outline','bg-primary','text-white','bg-gray-100');
  btn.classList.add('btn','btn-small');
  if (subscribed) { btn.classList.add('btn-primary'); btn.innerHTML = 'Subscribed'; }
  else { btn.classList.add('btn-muted'); btn.innerHTML = 'Subscribe'; }
}
