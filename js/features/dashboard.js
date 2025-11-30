import { $, $$, fadeIn, slideToggle, on, openModal, closeModal, show, hide, mountHTML, delegate, openConfirm, openTextPrompt, openInfoModal } from "../utils/dom.js";
import storageAdapter from "../storage/storageAdapter.js";
import { normalizeUrl } from "../utils/url.js";
import { USER_ID, DIGEST_TYPE, LIMITS, COOLDOWN } from "../config/constants.js";
import { createCard } from "../templates/card.js";
import { createDigestCard } from "../templates/digestCard.js";
import { escapeHTML, getTagClass, buildIconHTML } from "../utils/ui-helpers.js";
import { linkController } from "../controllers/linkController.js";
import { digestController } from "../controllers/digestController.js";

// Listen for storage events to update UI
storageAdapter.subscribe((event) => {
  if (event.type === 'subscriptions_changed') {
    markSubscribedButtons();
  }
});

// =============================
// 🎴 统一卡片模板与辅助函数
// =============================

// Check if a URL is subscribed
async function isUrlSubscribed(url = '') {
  return storageAdapter.isSubscribed(url);
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

export { createCard };

// =============================
// 💾 本地存储与数据模型（适配器模式）
// =============================

const RESERVED_CATEGORIES = new Set(['All Links']);

// Mark subscription button states
async function markSubscribedButtons() {
  const subs = await storageAdapter.getSubscriptions();
  // P0: Subscription ID-first mapping
  // We prefer matching by linkId. Fallback to URL.
  
  const container = document.getElementById('cardsContainer');
  if (!container) return;
  
  const btns = Array.from(container.querySelectorAll('.btn-subscribe'));
  for (const b of btns) {
    const cardEl = b.closest('.rune-card');
    const cardId = cardEl?.getAttribute('data-card-id');
    
    let isSubbed = false;
    let sub = null;

    // 1. Try match by ID (Primary)
    if (cardId) {
      sub = subs.find(s => s.enabled !== false && s.linkId === cardId);
      if (sub) isSubbed = true;
    }

    // 2. Fallback match by URL (Legacy/Migration)
    if (!isSubbed) {
        const rawUrl = b.getAttribute('data-url') || '';
        if (rawUrl) {
            isSubbed = await storageAdapter.isSubscribed(rawUrl);
            if (isSubbed) {
                const nUrl = normalizeUrl(rawUrl);
                sub = subs.find(s => s.enabled !== false && normalizeUrl(s.url) === nUrl);
            }
        }
    }
    
    // 1. Toggle Subscribe Button visibility
    if (isSubbed) {
      b.classList.add('hidden');
    } else {
      b.classList.remove('hidden');
      // Ensure it looks like a subscribe button
      b.textContent = 'Subscribe';
      b.disabled = false;
      b.classList.remove('btn-outline', 'text-primary');
      b.classList.add('btn-muted');
    }

    const wrap = b.closest('.card-actions');
    if (!wrap) return;
    
    // 2. Toggle Controls (Subscribed label + Generate Now)
    const controls = wrap.querySelector('.card-controls');
    const onceBtn = wrap.querySelector('.btn-generate-once');
    
    if (controls) {
      if (isSubbed) {
        controls.classList.remove('hidden');
        controls.classList.add('flex');
      } else {
        controls.classList.add('hidden');
        controls.classList.remove('flex');
      }
    }
    
    if (onceBtn) { 
      onceBtn.disabled = !isSubbed; 
      onceBtn.dataset.subId = sub?.id || '';
      onceBtn.dataset.linkId = cardId || ''; // Pass linkId for Generate Now
    }
  }
}

// Expose for external updates (e.g. from Settings)
window.refreshSubscriptionUI = markSubscribedButtons;

function syncCardControlsVisibility() {
  markSubscribedButtons(); // Re-use the main logic
}

// =============================
// ☁️ 云端 AI 封装（Supabase Edge Functions）
// =============================
const SUPABASE_URL = (import.meta?.env?.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta?.env?.VITE_SUPABASE_ANON_KEY || '').trim();
const useCloud = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Helper to manage the single global floating menu
let activeFloatingMenu = null;

function closeFloatingMenu() {
  if (activeFloatingMenu) {
    const trigger = document.querySelector('[data-menu-trigger="1"]');
    if (trigger) {
      trigger.removeAttribute('data-menu-trigger');
      trigger.setAttribute('aria-expanded', 'false');
    }
    activeFloatingMenu.remove();
    activeFloatingMenu = null;
    document.removeEventListener('click', onGlobalClickForMenu);
    try { delete document.body.dataset.menuOpen; } catch {}
  }
}

const onGlobalClickForMenu = (e) => {
  if (activeFloatingMenu && !activeFloatingMenu.contains(e.target) && !e.target.closest('[data-menu-trigger]')) {
    closeFloatingMenu();
  }
};

function createFloatingMenu(items, triggerEl) {
  closeFloatingMenu(); // Close existing

  const menu = document.createElement('div');
  menu.className = 'floating-menu fixed z-[9999] min-w-[160px] bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 text-sm flex flex-col animate-in fade-in zoom-in-95 duration-100';
  
  items.forEach(item => {
    if (item.hidden) return;
    const btn = document.createElement('button');
    btn.className = `w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${item.class || ''}`;
    btn.textContent = item.label;
    if (item.disabled) {
      btn.disabled = true;
      btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    btn.onclick = (e) => {
      e.stopPropagation();
      closeFloatingMenu();
      if (typeof item.onClick === 'function') item.onClick(e);
    };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  activeFloatingMenu = menu;

  // Position
  const rect = triggerEl.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  
  let top = rect.bottom + 4;
  let left = rect.right - menuRect.width; // Align right
  
  // Boundary checks (simple)
  if (left < 4) left = rect.left;
  if (top + menuRect.height > window.innerHeight) top = rect.top - menuRect.height - 4;

  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;

  // Mark trigger
  triggerEl.setAttribute('data-menu-trigger', '1');
  triggerEl.setAttribute('aria-expanded', 'true');
  try { document.body.dataset.menuOpen = '1'; } catch {}
  
  // Log for debug
  console.log('Menu opened for:', triggerEl.dataset.cardId || triggerEl.dataset.category || triggerEl.id, 'Rect:', rect);

  setTimeout(() => document.addEventListener('click', onGlobalClickForMenu), 0);
}

export function renderCategoriesSidebar() {
  const list = document.getElementById('linksGroupList');
  if (!list) return;
  list.innerHTML = '';
  const categories = linkController.getCategories();

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
    const btnId = `cat-btn-${safeName}`;
    // Get first letter for avatar
    const initial = (cat || 'U').charAt(0).toUpperCase();

    item.innerHTML = `
      <button class="category-filter text-sm font-medium text-left flex-1 focus:outline-none truncate mr-2" title="${escapeHTML(cat)}" data-initial="${escapeHTML(initial)}">${escapeHTML(cat)}</button>
      <div class="relative shrink-0">
        <button id="${btnId}" class="category-more p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-text-secondary-light dark:text-text-secondary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors" aria-haspopup="true" aria-expanded="false" aria-label="Options" data-category="${escapeHTML(cat)}">
          <span class="material-symbols-outlined text-base">more_horiz</span>
        </button>
      </div>
    `;
    list.appendChild(item);
  });
}

function syncEditCategorySelect() {
  const sel = document.getElementById('editLinkCategory');
  if (!sel) return;
  const categories = linkController.getCategories();
  sel.innerHTML = '<option value="">Select Category</option>' + categories.filter(c => c !== 'All Links').map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('') + '<option value="__new__">+ New category…</option>';
}

// Configuration
const DAILY_LIMIT_SINGLE = LIMITS.SINGLE_GENERATE;
const DAILY_LIMIT_DAILY = LIMITS.DAILY_GENERATE;
const COOLDOWN_MS = COOLDOWN.DURATION_MS;

// Helper: Check and update button state
function checkAndApplyCooldown(btn, type, linkId = null) {
  if (!btn) return;
  const userId = storageAdapter.getUser()?.id || USER_ID.GUEST;
  // 开发者账号(local-dev)拥有999次额度
  const isDev = userId === USER_ID.DEFAULT;
  const baseLimit = (type === 'single' || type === DIGEST_TYPE.MANUAL) ? DAILY_LIMIT_SINGLE : DAILY_LIMIT_DAILY;
  const limit = isDev ? LIMITS.DEV_LIMIT : baseLimit;
  
  // 1. Check Daily Limit
  const todayCount = storageAdapter.getDailyUsageCount(userId, type); 
  const remaining = Math.max(0, limit - todayCount);
  
  // Update Today Left Label if it exists next to button or update tooltip
  // Strategy: find or create a sibling element for text
  let label = btn.parentNode.querySelector('.limit-label');
  if (!label && btn.id === 'digestMockGenerate') {
       // Special case for digest button
       label = document.getElementById('digestLimitLabel');
  } else if (!label && btn.classList.contains('btn-generate-once')) {
      // For card buttons, maybe tooltip is better or small text below?
      // User said: "In the card... Display 'Today left: X / Y' next to each button."
      // Let's add it if missing
      label = btn.parentNode.querySelector('.limit-text');
      if (!label) {
          label = document.createElement('span');
          label.className = 'limit-text text-[10px] text-text-secondary-light dark:text-text-secondary-dark ml-2';
          btn.parentNode.appendChild(label);
      }
  }
  
  if (label) {
      label.textContent = `Today left: ${remaining}/${limit}`;
  }

  if (todayCount >= limit) {
    btn.disabled = true;
    btn.textContent = 'Limit Reached';
    btn.title = `Daily limit of ${limit} reached.`;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    return;
  }

  // 2. Check Cooldown
  const lastTime = storageAdapter.getLastGenerationTime(linkId, type);
  const now = Date.now();
  if (now - lastTime < COOLDOWN_MS) {
    const remainingTime = Math.ceil((COOLDOWN_MS - (now - lastTime)) / 1000);
    btn.disabled = true;
    btn.textContent = `Retry in ${remainingTime}s`;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    
    // Start countdown
    if (!btn.dataset.timer) {
      btn.dataset.timer = '1';
      const interval = setInterval(() => {
        const n = Date.now();
        if (n - lastTime >= COOLDOWN_MS) {
          clearInterval(interval);
          delete btn.dataset.timer;
          // Re-check
          checkAndApplyCooldown(btn, type, linkId);
        } else {
          const r = Math.ceil((COOLDOWN_MS - (n - lastTime)) / 1000);
          btn.textContent = `Retry in ${r}s`;
        }
      }, 1000);
    }
  } else {
    // Reset if not loading
    if (btn.dataset.loading !== '1') {
        btn.disabled = false;
        btn.textContent = (type === 'single' || type === DIGEST_TYPE.MANUAL) ? 'Generate Now' : "Generate Today's Digest";
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        delete btn.dataset.timer;
    }
  }
}

function updateDailyLimitUI() {
  const userId = storageAdapter.getUser()?.id || USER_ID.GUEST;
  
  // Update Digest UI
  const digestBtn = document.getElementById('digestMockGenerate');
  if (digestBtn) {
      checkAndApplyCooldown(digestBtn, DIGEST_TYPE.DAILY);
  }
  
  // Update all single buttons
  const container = document.getElementById('cardsContainer');
  if (container) {
      const btns = container.querySelectorAll('.btn-generate-once');
      btns.forEach(b => {
          const linkId = b.getAttribute('data-link-id');
          // 修复：确保linkId为数字类型，以便正确查询历史记录
          const numericLinkId = linkId ? (typeof linkId === 'string' ? parseInt(linkId, 10) : linkId) : null;
          checkAndApplyCooldown(b, DIGEST_TYPE.MANUAL, numericLinkId);
      });
  }
}

export function initDashboard() {
  console.log("📊 Dashboard initialized");
  
  // P0: Migration Trigger
  try {
    storageAdapter.migrateToIdBased();
  } catch (e) {
    console.error("Migration failed:", e);
  }

  if (import.meta?.env?.DEV) {
    if (window.location.search.includes('selftest')) {
      (async () => {
        try {
          const added = await linkController.addLink('example.com/selftest');
          console.log('✅ Self-test: add flow completed');
          await linkController.deleteLink(added.id);
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
  ];

    // Accordion functionality for sidebar groups
    navGroups.forEach(({ header, body }) => {
      const h = document.getElementById(header);
      const b = document.getElementById(body);
      if (h && b) {
        const icon = h.querySelector('.material-symbols-outlined');
        
        // Initialize state: Open by default
        // We use a data attribute to track state for reliability
        const isDefaultOpen = true;
        
        if (isDefaultOpen) {
          b.style.maxHeight = "none";
          b.style.overflow = "visible";
          b.setAttribute('data-expanded', 'true');
          h.setAttribute('aria-expanded', 'true');
          if (icon) icon.style.transform = 'rotate(180deg)';
        } else {
          b.style.maxHeight = "0px";
          b.style.overflow = "hidden";
          b.setAttribute('data-expanded', 'false');
          h.setAttribute('aria-expanded', 'false');
          if (icon) icon.style.transform = 'rotate(0deg)';
        }

        h.addEventListener("click", (e) => {
          e.preventDefault();
          const isExpanded = b.getAttribute('data-expanded') === 'true';

          if (isExpanded) {
            // Collapse
            // 1. Set fixed height to start transition
            b.style.maxHeight = b.scrollHeight + "px";
            b.style.overflow = "hidden";
            
            // 2. Force reflow
            b.offsetHeight;
            
            // 3. Transition to 0
            b.style.transition = "max-height 200ms ease-in-out";
            b.style.maxHeight = "0px";
            
            b.setAttribute('data-expanded', 'false');
            h.setAttribute('aria-expanded', 'false');
            if (icon) icon.style.transform = 'rotate(0deg)';
          } else {
            // Expand
            b.style.display = ''; // Ensure visible
            b.style.overflow = "hidden";
            b.style.transition = "max-height 200ms ease-in-out";
            b.style.maxHeight = b.scrollHeight + "px";
            
            b.setAttribute('data-expanded', 'true');
            h.setAttribute('aria-expanded', 'true');
            if (icon) icon.style.transform = 'rotate(180deg)';
            
            // Cleanup after transition
            const onEnd = () => {
              if (b.getAttribute('data-expanded') === 'true') {
                b.style.maxHeight = "none";
                b.style.overflow = "visible";
              }
              b.removeEventListener('transitionend', onEnd);
            };
            b.addEventListener('transitionend', onEnd, { once: true });
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
      try { loadAndRenderLinks(); } catch {}

    }
  }

async function renderDigestView() {
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
    const subs = await storageAdapter.getSubscriptions();
    const sel = document.getElementById('digestSub');
    if (sel) {
      sel.innerHTML = '<option value="">All Subscriptions</option>' + subs.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.title||s.url)}</option>`).join('');
    }
    const listEl = document.getElementById('digestList');
    const dateEl = document.getElementById('digestDate');
    const mockBtn = document.getElementById('digestMockGenerate');
    const searchEl = document.getElementById('digestSearch');
    const render = async () => {
      const rawDigests = await digestController.getDigestList();
      const links = await linkController.getLinks();
      
      // Use digestController to aggregate data
      const all = digestController.mergeDigestEntries(rawDigests, links);

      const date = dateEl?.value || '';
      const siteId = sel?.value || '';
      const keyword = (searchEl?.value || '').trim().toLowerCase();
      
      const merged = all.filter(d => (!date || d.date === date)).filter(d => {
        if (!siteId && !keyword) return true;
        const entries = Array.isArray(d.entries) ? d.entries : [];
        const bySite = !siteId || entries.some(e => String(e.subscriptionId) === String(siteId));
        const byText = !keyword || entries.some(e => (e.title||'').toLowerCase().includes(keyword) || (e.summary||'').toLowerCase().includes(keyword));
        return bySite && byText;
      }).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      
      listEl.innerHTML = merged.length ? '' : '<div class="col-span-full text-sm text-text-secondary-light dark:text-text-secondary-dark">No digests yet</div>';
      
      merged.forEach(d => {
        listEl.insertAdjacentHTML('beforeend', createDigestCard(d));
      });
    };
    render();
    // 修复：监听摘要变化事件，自动刷新UI
    storageAdapter.subscribe((e) => {
        if (e.type === 'digests_changed') render();
    });
    
    if (dateEl) on(dateEl, 'change', render);
    if (sel) on(sel, 'change', render);
    if (searchEl) on(searchEl, 'input', render);
    if (mockBtn) on(mockBtn, 'click', async () => {
      // P0: Check Limits
      const userId = storageAdapter.getUser()?.id || USER_ID.GUEST;
      const isDev = userId === USER_ID.DEFAULT;
      const limit = isDev ? LIMITS.DEV_LIMIT : DAILY_LIMIT_DAILY;
      
      if (storageAdapter.getDailyUsageCount(userId, DIGEST_TYPE.DAILY) >= limit) {
          openInfoModal({ title: 'Limit Reached', message: `You have reached the daily limit of ${limit} daily digests.` });
          return;
      }
      
      const lastTime = storageAdapter.getLastGenerationTime(null, DIGEST_TYPE.DAILY);
      if (Date.now() - lastTime < COOLDOWN_MS) {
          const wait = Math.ceil((COOLDOWN_MS - (Date.now() - lastTime))/1000);
          openInfoModal({ title: 'Cooldown', message: `Please wait ${wait}s before generating again.` });
          return;
      }

      const subsAll = (await storageAdapter.getSubscriptions()).filter(s=>s.enabled!==false);
      const targetId = sel?.value || '';
      // const targets = targetId ? subsAll.filter(s => s.id === targetId) : subsAll;
      // Moved logic to digestController
      
      mockBtn.dataset.loading = '1';
      setLoading(mockBtn, true, 'Generating…');
      
      try {
        const { successCount, failedCount, errors } = await digestController.generateDailyDigest(targetId);
        
        if (successCount === 0 && failedCount === 0) {
             openInfoModal({ title: 'No Subscriptions', message: 'No active subscriptions found to generate digest.' });
             delete mockBtn.dataset.loading;
             setLoading(mockBtn, false);
             return;
        }
        
        if (successCount === 0 && failedCount > 0) {
           throw new Error(errors[0]?.error || 'Failed to generate any summaries from subscriptions.');
        }

        // Log Success (Trigger Cooldown) - handled inside digestController via ai.js per site.
        // To maintain batch cooldown behavior, we rely on storageAdapter.getLastGenerationTime(null, 'daily')
        // finding the latest per-site log.

        const toast = document.createElement('div'); 
        toast.className='fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-primary text-white text-sm shadow-lg animate-in fade-in slide-in-from-bottom-4'; 
        toast.textContent=`Generated digests for ${successCount} sites!`; 
        document.body.appendChild(toast); 
        setTimeout(()=>toast.remove(),1600);
        
        // Refresh UI immediately
        render();
        updateDailyLimitUI(); 
        
      } catch (err) { 
          console.error('Generation failed', err); 
          openTextPrompt({ title: 'Generation Failed', placeholder: err.message || 'Failed to generate digests.' });
      } finally {
        delete mockBtn.dataset.loading;
        setLoading(mockBtn, false);
        updateDailyLimitUI();
      }
    });
    
    // Initialize cooldown state on view load
    updateDailyLimitUI();
    
    delegate(listEl, '.digest-delete', 'click', (e, btn) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (!id) return;
      openConfirm({
        title: 'Delete digest?',
        message: 'This action cannot be undone.',
        okText: 'Delete',
        onOk: async () => {
          await digestController.deleteDigest(id);
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
    
    delegate(listEl, '.digest-card', 'click', async (e, card) => {
      if (e.target.closest('button')) return;
      
      const id = card.getAttribute('data-digest-id');
      const all = await digestController.getDigestList();
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

    delegate(listEl, '.digest-view-btn', 'click', async (e, btn) => {
      e.preventDefault(); e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const all = await digestController.getDigestList();
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
  if (navDigest) on(navDigest, 'click', (e) => { e.preventDefault(); renderDigestView(); });
  if (navChat) on(navChat, 'click', (e) => { e.preventDefault(); renderChatView(); });

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

  // 获取当前用户信息
  const user = storageAdapter.getUser();
  const userName = user?.nickname || 'Developer';
  const userId = user?.id || 'local-dev';
  
  const card = document.getElementById("userWelcomeCard");
  if (card) {
    card.innerHTML = `
      <div class="user-welcome-card">
        <h2 class="text-lg font-bold mb-1">Good evening, <span class="text-primary">${userName}</span> 👋</h2>
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">A night full of inspiration.</p>
        <div class="mt-2">
          <span class="text-xs text-primary font-medium">Developer Mode • User: ${userId}</span>
        </div>
      </div>`;
  }

  // 更新头像容器
  const avatarContainer = document.getElementById("userDropdownContainer");
  if (avatarContainer) {
    const userAvatar = user?.avatar || 'https://i.pravatar.cc/100?img=12';
    avatarContainer.innerHTML = `
      <img src="${userAvatar}" alt="User Avatar"
        class="user-avatar" title="${userName}" />`;
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
      
      setLoading(saveLinkBtn, true, 'Generating summary…');
      
      try {
          const added = await linkController.addLink(raw);
          const html = createCard(added);
          cardsContainer.insertAdjacentHTML('afterbegin', html);
          markSubscribedButtons();
          inpUrl.value = '';
          closeModal(addLinkModal);
      } catch (err) {
          openTextPrompt({ title: 'Error', placeholder: err.message });
      } finally {
          setLoading(saveLinkBtn, false);
      }
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

  async function loadAndRenderLinks() {
    const container = document.getElementById('cardsContainer');
    if (!container) return;
    
    let links = await linkController.getLinks();

    if (links.length === 0 && !useCloud) {
         await linkController.injectSamples();
         links = await linkController.getLinks();
    }
    
    container.innerHTML = '';
    links.forEach(c => {
        const html = createCard(c);
        container.insertAdjacentHTML('beforeend', html);
    });
    
    renderCategoriesSidebar();
    syncEditCategorySelect();
    markSubscribedButtons();
    updateDailyLimitUI();
  }

  

  loadAndRenderLinks();

  const handleSubscribe = async (e, btn) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    
    // 显示加载状态
    setLoading(btn, true, 'Subscribing...');
    
    try {
      const cardEl = btn.closest('.rune-card');
      const idStr = cardEl?.getAttribute('data-card-id');
      const cardId = idStr ? parseInt(idStr, 10) : null;
      
      // P0: Operate on link.id
      if (!cardId) {
          // Fallback to URL if no ID (should not happen for valid cards)
          const url = normalizeUrl(btn.getAttribute('data-url') || '');
          if (!url) {
            openTextPrompt({ title: 'Error', placeholder: 'Invalid URL for subscription' });
            return;
          }
          // Try to find ID by URL
          const cards = await linkController.getLinks();
          const link = cards.find(c => normalizeUrl(c.url) === url);
          if (link) {
              await storageAdapter.subscribeToLink(link.id);
          } else {
               console.error('Link not found for subscription');
               openTextPrompt({ title: 'Error', placeholder: 'Link not found for subscription' });
               return;
          }
      } else {
          await storageAdapter.subscribeToLink(cardId);
      }
      
      // 成功提示
      const t = document.createElement('div'); 
      t.className='fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-green-500 text-white text-sm shadow-lg animate-in fade-in slide-in-from-bottom-4'; 
      t.textContent='Subscribed successfully!'; 
      document.body.appendChild(t); 
      setTimeout(()=>t.remove(),1600);
      
    } catch (error) {
      console.error('Subscribe failed:', error);
      openTextPrompt({ title: 'Subscription Failed', placeholder: error.message || 'Failed to subscribe to link' });
    } finally {
      setLoading(btn, false);
      markSubscribedButtons();
    }
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
    async function openFreqModal(subId) {
      __freqEditingSubId = subId;
      const subs = await storageAdapter.getSubscriptions();
      const sub = subs.find(s => s.id === subId) || {};
      if (freqSelect) freqSelect.value = sub.frequency || 'daily';
      freqModal?.classList.remove('hidden');
    }
    function closeFreqModal() { __freqEditingSubId = null; freqModal?.classList.add('hidden'); }
    if (freqCancel) freqCancel.addEventListener('click', () => closeFreqModal());
    if (freqOk) freqOk.addEventListener('click', async () => {
      if (!__freqEditingSubId) { closeFreqModal(); return; }
      const val = freqSelect?.value || 'daily';
      const subs = await storageAdapter.getSubscriptions();
      const idx = subs.findIndex(s => s.id === __freqEditingSubId);
      if (idx !== -1) {
        await storageAdapter.updateSubscription({ ...subs[idx], frequency: val, lastChecked: subs[idx].lastChecked || 0 });
      }
      markSubscribedButtons();
      closeFreqModal();
    });

    delegate(document, '.btn-generate-once', 'click', async (e, b) => {
      e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      
      // P0: Check Limits
      const subId = b.getAttribute('data-sub-id') || '';
      const linkId = b.getAttribute('data-link-id') || ''; 
      const userId = storageAdapter.getUser()?.id || 'guest';
      
      // Check Daily
      const isDev = userId === 'local-dev';
      const limit = isDev ? 999 : DAILY_LIMIT_SINGLE;

      if (storageAdapter.getDailyUsageCount(userId, 'manual') >= limit) {
          openInfoModal({ title: 'Limit Reached', message: `You have reached the daily limit of ${limit} generations for Single links.` });
          return;
      }
      
      // Check Cooldown
      const lastTime = storageAdapter.getLastGenerationTime(linkId, 'manual');
      if (Date.now() - lastTime < COOLDOWN_MS) {
          const wait = Math.ceil((COOLDOWN_MS - (Date.now() - lastTime))/1000);
          openInfoModal({ title: 'Cooldown', message: `Please wait ${wait}s before generating again.` });
          return;
      }

      const subs = (await storageAdapter.getSubscriptions()).filter(s=>s.enabled!==false);
      // Find by ID or subId - 处理ID类型不匹配问题
      const numericLinkId = linkId ? (typeof linkId === 'string' ? parseInt(linkId, 10) : linkId) : null;
      const target = subs.find(s => {
        // 处理linkId匹配（考虑字符串和数字类型）
        if (linkId && s.linkId) {
          const sLinkId = typeof s.linkId === 'string' ? parseInt(s.linkId, 10) : s.linkId;
          const searchLinkId = numericLinkId || linkId;
          return sLinkId === searchLinkId;
        }
        // 处理subId匹配
        if (subId && s.id === subId) return true;
        return false;
      });
      if (!target) {
        console.error('Subscription not found for linkId:', linkId, 'subId:', subId);
        openTextPrompt({ title: 'Error', placeholder: 'Subscription not found. Please check if the link is subscribed or try refreshing the page.' });
        return;
      }

      b.dataset.loading = '1'; // Mark loading for cooldown check
      setLoading(b, true, 'Generating…');
      try {
        // Use digestController for logic
        const finalLinkId = target.linkId || linkId;
        await digestController.generateManualDigest(finalLinkId);
        
        const t = document.createElement('div'); 
        t.className='fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-primary text-white text-sm shadow-lg animate-in fade-in slide-in-from-bottom-4'; 
        t.textContent='Digest generated successfully!'; 
        document.body.appendChild(t); 
        setTimeout(()=>t.remove(),1600);
        
        delete b.dataset.loading;
        updateDailyLimitUI(); // This triggers cooldown countdown
        
      } catch (err) { 
          console.error('Generation failed', err); 
          // 更具体的错误提示
          let errorMessage = 'Failed to generate digest';
          if (err.message && err.message.includes('Link not found')) {
            errorMessage = 'Link not found. Please check if the link exists or try refreshing the page.';
          } else if (err.message) {
            errorMessage = err.message;
          }
          openTextPrompt({ title: 'Generation Failed', placeholder: errorMessage });
          // Log Failure (optional, mostly for debug)
          console.log('Generation failed, not logging quota');
      }
      delete b.dataset.loading;
      setLoading(b, false);
      // Ensure UI is consistent even if failed
      updateDailyLimitUI();
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
      e.stopPropagation(); // Stop bubbling to document
      
      closeUserDropdown();
      
      const card = btn.closest('.rune-card');
      const menu = card?.querySelector('.rune-card-menu');
      if (!menu) return;

      const isCurrentlyOpen = !menu.classList.contains('hidden');

      // Close all other menus first
      closeAllMenusDoc();

      if (!isCurrentlyOpen) {
        menu.classList.remove('hidden');
        try { document.body.dataset.menuOpen = '1'; } catch {}
        
        // One-time click listener to close on outside click
        const onDocClick = (ev) => {
          // If click is inside the menu, do nothing (unless it's a button which handles itself)
          // If click is on the trigger button, do nothing (let the button handler handle it? No, button handler is this one)
          // Actually, if I click the button again, 'isCurrentlyOpen' will be true, so it closes.
          // So I only need to handle clicks *elsewhere*.
          if (menu.contains(ev.target)) return;
          if (btn.contains(ev.target)) return; // Let the button click handler handle toggle off
          
          menu.classList.add('hidden');
          document.removeEventListener('click', onDocClick);
          try { delete document.body.dataset.menuOpen; } catch {}
        };
        
        // Delay adding listener to avoid catching the current click event
        setTimeout(() => document.addEventListener('click', onDocClick), 0);
        
        const onEsc = (ev) => { 
            if (ev.key === 'Escape') { 
                menu.classList.add('hidden'); 
                document.removeEventListener('keydown', onEsc); 
                try { delete document.body.dataset.menuOpen; } catch {}
            } 
        };
        document.addEventListener('keydown', onEsc, { once: true });
      } else {
         // If it was open, we just closed it via closeAllMenusDoc.
         try { delete document.body.dataset.menuOpen; } catch {}
      }
    });

delegate(document, '.menu-edit', 'click', async (e, btn) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeUserDropdown();
      closeAllMenusDoc(); // Close menu immediately
      const cardEl = btn.closest('.rune-card');
      // 修复：确保 ID 类型一致（IndexedDB 中为数字）
      const idStr = cardEl?.getAttribute('data-card-id');
      const id = idStr ? parseInt(idStr, 10) : null;
      
      const cards = await linkController.getLinks();
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
      if (fURL) fURL.removeAttribute('readonly'); // P1: Allow editing URL
      if (fDesc) fDesc.value = data.description || '';
      if (fTags) fTags.value = Array.isArray(data.tags) ? data.tags.join(',') : '';
      syncEditCategorySelect();
      if (fCat) fCat.value = data.category || '';
      if (fCatNew) { fCatNew.value = ''; fCatNew.classList.add('hidden'); }
      openModal(modal);
      const form = document.getElementById('editLinkForm');
      const cancelBtn = document.getElementById('cancelEditBtn');
      const menu = cardEl.querySelector('.rune-card-menu');
      const onSubmit = async (ev) => {
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
        
        try {
            const updated = await linkController.updateLink(id, { title, url, description, tags, category });
            if (updated && cardEl) {
              cardEl.style.transition = 'opacity 120ms ease';
              cardEl.style.opacity = '0.4';
              cardEl.outerHTML = createCard(updated);
            }
            if (menu) menu.classList.add('hidden');
            closeModal(modal);
            form?.removeEventListener('submit', onSubmit);
            cancelBtn?.removeEventListener('click', onCancel);
        } catch (err) {
            openTextPrompt({ title: 'Error', placeholder: err.message });
        }
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

    delegate(document, '.menu-delete', 'click', async (e, btn) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeUserDropdown();
      closeAllMenusDoc(); // Close menu immediately
      
      try {
        const cardEl = btn.closest('.rune-card');
        const idStr = cardEl?.getAttribute('data-card-id');
        const id = idStr ? parseInt(idStr, 10) : null;
        if (!id) throw new Error('Card ID missing');

        const cards = await linkController.getLinks();
        const data = cards.find(c => c.id === id);
        if (!data) throw new Error('Link data not found');

        const menu = cardEl.querySelector('.rune-card-menu');
        openConfirm({
          title: `Delete saved link "${escapeHTML(data?.title || (data?.url||'').replace(/^https?:\/\//,''))}"?`,
          message: 'This will remove the link and its related digest entries.',
          okText: 'Delete',
          okDanger: true,
          onOk: () => {
            // Optimistic UI removal
            cardEl.style.transition = 'opacity 160ms ease';
            cardEl.style.opacity = '0';
            setTimeout(() => { cardEl.remove(); }, 180);
            
            (async () => { 
              try { 
                await linkController.deleteLink(id);
              } catch (err) {
                console.error('Delete failed', err);
                openTextPrompt({ title: 'Delete Failed', placeholder: 'Failed to delete link.' });
              }
            })();

            if (menu) menu.classList.add('hidden');
          }
        });
      } catch (err) {
        console.error('Delete menu error:', err);
        openTextPrompt({ title: 'Error', placeholder: err.message || 'Failed to prepare delete action.' });
      }
    });


    // 移除卡片内的取消订阅入口（按规范迁移到 Settings 面板）
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
      // Settings button logic removed as sidebar item is removed.
      // If we need to restore settings access via dropdown, re-implement openSettings logic here.
      // For now, user requested removing settings from sidebar.
      // But the dropdown might still have "Settings".
      // The user said "remove settings under runearea", which refers to the sidebar group.
      // I will keep the dropdown item working if possible, but the `navSettings` element is gone.
      // So I need to inline the settings open logic or move it to a function.
      
      // However, since I deleted the navSettings logic block, the dropdown button will do nothing if it tries to click navSettings.
      // Let's define openSettings function to be used by dropdown.
      
      const openSettings = () => {
        const backdrop = document.getElementById('modalBackdrop');
        const container = document.getElementById('settingsModalContainer');
        if (!container) return;
        let panel = document.getElementById('settingsPanel');
        
        // Re-create panel every time to ensure clean state or just hide/show?
        // Better to re-create or reset content to match new design structure if it doesn't exist.
        // Since we are changing the structure completely, let's check if the existing panel matches new structure.
        // For simplicity, if it exists but has old structure (simple div), we might want to replace it.
        // But usually we just create it once. Let's assume we can recreate it if needed or just update innerHTML.
        // To be safe and ensure new design loads, I will remove it if it exists and re-create, 
        // OR just update innerHTML. Updating innerHTML is safer.
        
        if (!panel) {
          panel = document.createElement('div');
          panel.id = 'settingsPanel';
          panel.className = 'fixed inset-0 z-50 flex items-center justify-center pointer-events-none'; // pointer-events-none for wrapper, auto for content
          container.appendChild(panel);
        }
        
        // Reset pointer events for the modal content
        panel.innerHTML = `
          <div class="pointer-events-auto relative w-[640px] h-[480px] bg-white dark:bg-surface-dark rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <!-- Left Sidebar -->
            <div class="w-48 flex-shrink-0 bg-gray-50 dark:bg-black/20 border-r border-gray-100 dark:border-gray-700/50 flex flex-col">
              <div class="p-4 pb-2">
                <h2 class="text-sm font-bold text-text-primary-light dark:text-text-primary-dark px-2">Settings</h2>
              </div>
              <nav class="flex-1 px-2 py-2 space-y-0.5">
                <button data-tab="general" class="settings-tab-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors bg-gray-200 dark:bg-white/10 text-primary">
                  General
                </button>
                <button data-tab="notifications" class="settings-tab-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                  Notifications
                </button>
                <button data-tab="subscriptions" class="settings-tab-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                  Subscriptions
                </button>
              </nav>
              <div class="p-3 border-t border-gray-100 dark:border-gray-700/50">
                 <button id="settingsCloseBtn" class="w-full py-1.5 rounded-lg text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">Close</button>
              </div>
            </div>
            
            <!-- Right Content -->
            <div class="flex-1 flex flex-col h-full overflow-hidden bg-surface-light dark:bg-surface-dark">
              <!-- Tab: General -->
              <div id="tab-content-general" class="settings-tab-content flex-1 p-6 overflow-y-auto">
                <h3 class="text-sm font-bold mb-4 text-text-primary-light dark:text-text-primary-dark">General</h3>
                <div class="space-y-6">
                  <!-- Appearance -->
                  <div>
                    <label class="block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2">Appearance</label>
                    <div class="relative">
                      <select id="themeSelect" class="w-full h-9 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-xs px-3 focus:ring-2 focus:ring-primary/50 outline-none appearance-none">
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                      <span class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-[10px]">▼</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tab: Notifications -->
              <div id="tab-content-notifications" class="settings-tab-content flex-1 p-6 overflow-y-auto hidden">
                <h3 class="text-sm font-bold mb-4 text-text-primary-light dark:text-text-primary-dark">Notifications</h3>
                <div class="space-y-4">
                  <label class="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-white/5 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                    <div>
                      <div class="text-xs font-medium text-text-primary-light dark:text-text-primary-dark">Email Notifications</div>
                      <div class="text-[10px] text-text-secondary-light dark:text-text-secondary-dark mt-0.5">Receive daily digests via email</div>
                    </div>
                    <div class="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" id="emailNotifToggle" class="sr-only peer">
                      <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Tab: Subscriptions -->
              <div id="tab-content-subscriptions" class="settings-tab-content flex-1 p-0 flex flex-col h-full hidden">
                <div class="p-6 pb-2 flex-shrink-0">
                   <h3 class="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">Subscriptions</h3>
                </div>
                <div id="subsSettingsList" class="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6 pt-2">
                  <!-- Content injected by settings-panel.js -->
                </div>
              </div>
            </div>
          </div>`;
        
        show(backdrop);
        show(panel);

        // Initialize Theme Select
        const themeSelect = document.getElementById('themeSelect');
        const html = document.documentElement;
        if (themeSelect) {
            themeSelect.value = html.classList.contains('dark') ? 'dark' : 'light';
            themeSelect.addEventListener('change', (e) => {
                if (e.target.value === 'dark') {
                    html.classList.add('dark');
                    html.classList.remove('light');
                    localStorage.setItem('theme', 'dark');
                } else {
                    html.classList.remove('dark');
                    html.classList.add('light');
                    localStorage.setItem('theme', 'light');
                }
            });
        }

        // Tab Switching Logic
        const tabs = panel.querySelectorAll('.settings-tab-btn');
        const contents = panel.querySelectorAll('.settings-tab-content');
        
        tabs.forEach(tab => {
          tab.addEventListener('click', () => {
            // Reset all tabs styling
            tabs.forEach(t => {
              t.classList.remove('bg-gray-200', 'dark:bg-white/10', 'text-primary');
              t.classList.add('text-text-secondary-light', 'dark:text-text-secondary-dark', 'hover:bg-gray-100', 'dark:hover:bg-white/5');
            });
            // Active tab styling
            tab.classList.remove('text-text-secondary-light', 'dark:text-text-secondary-dark', 'hover:bg-gray-100', 'dark:hover:bg-white/5');
            tab.classList.add('bg-gray-200', 'dark:bg-white/10', 'text-primary');
            
            // Show content
            const target = tab.getAttribute('data-tab');
            contents.forEach(c => c.classList.add('hidden'));
            document.getElementById(`tab-content-${target}`).classList.remove('hidden');
            
            // If switching to subscriptions, render them (lazy load optional, but fine to call always)
            if (target === 'subscriptions') {
               try { if (typeof window.renderSubscriptionsSettings === 'function') window.renderSubscriptionsSettings(); } catch {}
            }
          });
        });

        // Initial Render of Subscriptions (in case user clicks tab, or if we want to preload)
        // But since default tab is general, we wait.
        
        // Close handlers
        const closeBtn = document.getElementById('settingsCloseBtn');
        if (closeBtn) {
           const newBtn = closeBtn.cloneNode(true);
           closeBtn.parentNode.replaceChild(newBtn, closeBtn);
           on(newBtn, 'click', () => { hide(panel); hide(backdrop); });
        }
        const onBackdropClick = () => { hide(panel); hide(backdrop); };
        backdrop.removeEventListener('click', onBackdropClick);
        on(backdrop, 'click', () => { hide(panel); hide(backdrop); });
      };

      if (settingsBtn) on(settingsBtn, 'click', () => {
        menu.classList.remove('show');
        openSettings();
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
      linkController.ensureCategory(name);
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
      const cat = btn.getAttribute('data-category') || '';
      if (!cat) return;
      
      createFloatingMenu([
        { label: 'Rename Category', disabled: true },
        { 
          label: 'Delete Category', 
          class: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20',
          onClick: () => handleDeleteCategory(cat) 
        }
      ], btn);
    });
    
    // Helper for Delete Category Logic
    const handleDeleteCategory = (name) => {
      if (!name || RESERVED_CATEGORIES.has(name)) {
        console.warn('Attempted to delete invalid or reserved category:', name);
        return;
      }

      openConfirm({
        title: `Delete category "${escapeHTML(name)}"?`,
        message: 'This will remove the category, but the links inside will remain available under All Links.',
        okText: 'Delete',
        okDanger: true,
        onOk: async () => {
          // 1. Delete category via Controller
          await linkController.deleteCategory(name);

          // 2. Update UI
          renderCategoriesSidebar();
          syncEditCategorySelect();
          
          // 3. Re-render cards to reflect updated category in DOM
          const container = document.getElementById('cardsContainer');
          if (container) {
             container.innerHTML = '';
             const updatedLinks = await linkController.getLinks();
             updatedLinks.forEach(c => {
               const html = createCard(c);
               container.insertAdjacentHTML('beforeend', html);
             });
             // Re-bind events since we wiped container
             if (typeof markSubscribedButtons === 'function') markSubscribedButtons();
          }

          // 4. Switch view to All Links
          // Since we just re-rendered, all cards are visible. 
          // We just need to highlight "All Links" in sidebar.
          const allLinksBtn = linksGroupList.querySelector('[data-name=""] .category-filter');
          const allLinksItem = linksGroupList.querySelector('[data-name=""]');
          
          // Reset all active states
          linksGroupList.querySelectorAll('.bg-gray-200, .dark:bg-white\\/10').forEach(el => {
             el.classList.remove('bg-gray-200', 'dark:bg-white/10');
             el.classList.add('bg-gray-50', 'dark:bg-white/5');
          });
          
          if (allLinksItem) {
             allLinksItem.classList.remove('bg-gray-50', 'dark:bg-white/5');
             allLinksItem.classList.add('bg-gray-200', 'dark:bg-white/10');
          }
          
          // Show success toast
          try {
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-gray-800 text-white text-sm shadow-lg animate-in slide-in-from-bottom-4 fade-in duration-300';
            toast.textContent = `Category "${name}" deleted`;
            document.body.appendChild(toast);
            setTimeout(() => {
               toast.classList.add('fade-out', 'slide-out-to-bottom-4');
               setTimeout(() => toast.remove(), 300);
            }, 2000);
          } catch {}
        }
      });
    };
  }
}

function loadUserWelcome() {
  // 获取当前用户信息
  const user = storageAdapter.getUser();
  const userName = user?.nickname || 'Developer';
  const userId = user?.id || 'local-dev';
  const userAvatar = user?.avatar || 'https://i.pravatar.cc/100?img=12';
  
  const card = document.getElementById("userWelcomeCard");
  if (card) {
    card.innerHTML = `
      <div class="user-welcome-card">
        <h2 class="text-lg font-bold mb-1">Good evening, <span class="text-primary">${userName}</span> 👋</h2>
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">A night full of inspiration.</p>
        <div class="mt-2">
          <span class="text-xs text-primary font-medium">Developer Mode • User: ${userId}</span>
        </div>
      </div>`;
  }

  const avatarContainer = document.getElementById("userDropdownContainer");
  if (avatarContainer) {
    avatarContainer.innerHTML = `
      <img src="${userAvatar}" alt="User Avatar"
        class="user-avatar" title="${userName}" />`;
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
