import { $, $$, fadeIn, slideToggle, on, openModal, closeModal, show, hide, mountHTML, delegate, openConfirm, openTextPrompt, openInfoModal } from "../utils/dom.js";
import storageAdapter from "../storage/storageAdapter.js";
import { normalizeUrl } from "../utils/url.js";
import { USER_ID, DIGEST_TYPE, LIMITS, COOLDOWN } from "../config/constants.js";
import { createCard } from "../templates/card.js";
import { createDigestCard } from "../templates/digestCard.js";
import { escapeHTML, getTagClass, buildIconHTML } from "../utils/ui-helpers.js";
import { linkController } from "../controllers/linkController.js";
import { syncLoop } from "../sync/syncAgent.js";
import { digestController } from "../controllers/digestController.js";
import * as linksView from "../views/linksView.js";
import * as digestView from "../views/digestView.js";

// Listen for storage events to update UI
storageAdapter.subscribe((event) => {
  const cardsContainer = document.getElementById('cardsContainer');
  const digestList = document.getElementById('digestList');

  if (event.type === 'links_changed' || event.type === 'subscriptions_changed') {
      if (cardsContainer) {
          linksView.renderLinks();
      }
  }
  
  if (event.type === 'digests_changed' || event.type === 'links_changed') {
      if (digestList) {
          // If Digest View is active
          digestView.renderDigests();
      }
  }
});

// =============================
// ☁️ 云端 AI 封装（Supabase Edge Functions）
// =============================
const SUPABASE_URL = (import.meta?.env?.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta?.env?.VITE_SUPABASE_ANON_KEY || '').trim();
const useCloud = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export function initDashboard() {
  console.log("📊 Dashboard initialized");
  
  // P0: Migration Trigger
  (async () => {
    try {
      await storageAdapter.migrateToIdBased();
    } catch (e) {
      console.error("Migration failed:", e);
    }
    
    // Initialize Views
    const context = {
        containerEl: null, // Will be set per render
        controllers: { linkController, digestController },
        templates: { createCard, createDigestCard },
        utils: { 
            dom: { $, $$, fadeIn, slideToggle, on, openModal, closeModal, show, hide, mountHTML, delegate, openConfirm, openTextPrompt, openInfoModal },
            storageAdapter // Passing for read-only user/global info
        }
    };
    
    // Initialize View Modules (passing context that doesn't change)
    // ContainerEl changes on navigation, so we pass it during render?
    // The init function stored it. 
    // Let's pass containerEl: document.getElementById('cardsContainer') for linksView
    // But cardsContainer might not exist if we are on another tab?
    // Actually, index.html has cardsContainer inside main by default?
    // Let's check index.html or main rendering logic.
    // defaultMainHTML has 'cardsContainer'.
    
    const mainEl = document.querySelector('main');
    
    // Init Views
    linksView.initLinksView({ ...context, containerEl: document.getElementById('cardsContainer') });
    digestView.initDigestView({ ...context, containerEl: mainEl }); // Digest view mounts to mainEl
    
    // Phase 3: Partial Update - Inject View into Controller
    linkController.setView(linksView);
    digestController.setView(digestView);

    // Initial Render
    renderDefaultMain();

    // 启动后台同步循环（在线时定期推送变更）
    try { syncLoop(); } catch {}
  })();

  const mainEl = document.querySelector('main');
  const defaultMainHTML = mainEl ? mainEl.innerHTML : '';
  
  // Sidebar Toggle Logic
  const toggle = document.getElementById("sidebarToggle");
  const logoBtn = document.getElementById("logoBtn");
  const sidebar = document.querySelector(".sidebar");
  
  const toggleSidebar = (forceState) => {
    if (!sidebar) return;
    const isCollapsed = forceState !== undefined ? forceState : !sidebar.classList.contains("aside-collapsed");
    if (isCollapsed) {
      sidebar.classList.add("aside-collapsed");
      sidebar.setAttribute("aria-expanded", "false");
    } else {
      sidebar.classList.remove("aside-collapsed");
      sidebar.setAttribute("aria-expanded", "true");
    }
    try { localStorage.setItem("sidebarCollapsed", isCollapsed); } catch {}
  };

  try {
    const stored = localStorage.getItem("sidebarCollapsed");
    if (window.innerWidth > 768 && stored === 'true') toggleSidebar(true);
  } catch {}

  if (logoBtn) {
    on(logoBtn, "click", () => toggleSidebar());
    on(logoBtn, "keydown", (e) => { if (e.key === 'Enter' || e.key === ' ') toggleSidebar(); });
  }
  if (toggle) toggle.addEventListener("click", () => toggleSidebar());

  // Navigation Groups (Accordion)
  const navGroups = [
    { header: "linksGroupHeader", body: "linksGroupBody" },
    { header: "subsGroupHeader", body: "subsGroupBody" },
    { header: "aiGroupHeader", body: "aiGroupBody" },
  ];
  navGroups.forEach(({ header, body }) => {
      const h = document.getElementById(header);
      const b = document.getElementById(body);
      if (h && b) {
          const icon = h.querySelector('.material-symbols-outlined');
          // Default Open
          b.style.maxHeight = "none";
          b.style.overflow = "visible";
          b.setAttribute('data-expanded', 'true');
          h.setAttribute('aria-expanded', 'true');
          if (icon) icon.style.transform = 'rotate(180deg)';

          h.addEventListener("click", (e) => {
              e.preventDefault();
              const isExpanded = b.getAttribute('data-expanded') === 'true';
              if (isExpanded) {
                  b.style.maxHeight = b.scrollHeight + "px";
                  b.style.overflow = "hidden";
                  b.offsetHeight; // reflow
                  b.style.transition = "max-height 200ms ease-in-out";
                  b.style.maxHeight = "0px";
                  b.setAttribute('data-expanded', 'false');
                  h.setAttribute('aria-expanded', 'false');
                  if (icon) icon.style.transform = 'rotate(0deg)';
              } else {
                  b.style.display = '';
                  b.style.overflow = "hidden";
                  b.style.transition = "max-height 200ms ease-in-out";
                  b.style.maxHeight = b.scrollHeight + "px";
                  b.setAttribute('data-expanded', 'true');
                  h.setAttribute('aria-expanded', 'true');
                  if (icon) icon.style.transform = 'rotate(180deg)';
                  b.addEventListener('transitionend', () => {
                      if (b.getAttribute('data-expanded') === 'true') {
                          b.style.maxHeight = "none";
                          b.style.overflow = "visible";
                      }
                  }, { once: true });
              }
          });
      }
  });

  // Nav Items Active State
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
      // Cleanup other scrolls
      digestView.disableInfiniteScroll();

      mainEl.innerHTML = defaultMainHTML;
      // Update container reference for LinksView as DOM changed
      linksView.initLinksView({ 
          containerEl: document.getElementById('cardsContainer'), 
          controllers: { linkController, digestController },
          templates: { createCard, createDigestCard },
          utils: { dom: {$,$$,fadeIn,slideToggle,on,openModal,closeModal,show,hide,mountHTML,delegate,openConfirm,openTextPrompt,openInfoModal}, storageAdapter }
      });
      linkController.setView(linksView);
      
      // Phase 3: Pagination (Load Page 0)
      linkController.fetchPage(0, 20).then(({ items }) => {
          linksView.renderLinks(items);
          // Enable Infinite Scroll
          const scrollContainer = document.getElementById('mainScrollContainer');
          linksView.enableInfiniteScroll(scrollContainer, {
              onLoadMore: () => linkController.loadNextPage()
          });
      });
      
      linksView.bindLinksEvents();
    }
  }
  
  // Navigation Logic
  const navDigest = document.getElementById('navDigest');
  const navChat = document.getElementById('navChat');
  const navLinks = document.querySelector('.nav-item[href="#"]'); // Assuming Home/Links is default
  
  // ...
  
  // For now, let's assume clicking "Digest" switches view.
  if (navDigest) on(navDigest, 'click', (e) => { 
      e.preventDefault(); 
      linksView.disableInfiniteScroll();
       digestView.renderDigests().then(() => {
           const scrollContainer = document.getElementById('mainScrollContainer');
           digestView.enableInfiniteScroll(scrollContainer, {
               onLoadMore: () => digestController.loadNextPage()
           });
       });
  });
  
  // We need a way to go back to Links. 
  // The "Links" header or items inside it.
  const linksHeader = document.getElementById('linksGroupHeader');
  if (linksHeader) {
      // If I click header, it toggles accordion.
      // Maybe I need a "Home" button.
      // The logo does it?
  }
  if (logoBtn) on(logoBtn, 'click', renderDefaultMain); // Logo goes home

  // Chat View (Placeholder)
  if (navChat) on(navChat, 'click', (e) => { 
      e.preventDefault(); 
      renderChatView(); 
  });

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
    // ... Chat logic ...
  }

  // User Welcome & Dropdown
  loadUserWelcome();
  
  function loadUserWelcome() {
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
      avatarContainer.innerHTML = `<img src="${userAvatar}" alt="User Avatar" class="user-avatar" title="${userName}" />`;
      
      // Dropdown logic
      let menu = avatarContainer.querySelector('.user-dropdown');
      if (!menu) {
          menu = document.createElement('div');
          menu.className = 'user-dropdown';
          menu.innerHTML = `
            <ul class="p-2">
              <li><button id="profileBtn" class="w-full text-left px-3 py-2 text-sm">Profile</button></li>
              <li><button id="settingsBtn" class="w-full text-left px-3 py-2 text-sm">Settings</button></li>
              <li><button id="logoutBtn" class="w-full text-left px-3 py-2 text-sm">Log out</button></li>
            </ul>`;
          avatarContainer.appendChild(menu);
      }
      const avatar = avatarContainer.querySelector('.user-avatar');
      if (avatar) {
          on(avatar, 'click', (e) => {
              e.stopPropagation();
              menu.classList.toggle('show');
          });
      }
      // ... settings btn logic ...
      const settingsBtn = document.getElementById('settingsBtn');
      if (settingsBtn) on(settingsBtn, 'click', () => {
          menu.classList.remove('show');
          openSettings();
      });
      
      document.addEventListener('click', (e) => {
          if (!avatarContainer.contains(e.target)) menu.classList.remove('show');
      });
    }
  }

  // Notifications
  const headerButtons = Array.from(document.querySelectorAll('header button'));
  const notifyBtn = headerButtons.find((btn) => btn.querySelector('.material-symbols-outlined')?.textContent?.trim() === 'notifications');
  if (notifyBtn) {
      on(notifyBtn, 'click', () => {
          // ... notification panel logic ...
          let panel = document.getElementById('notifPanel');
          if (!panel) {
              panel = document.createElement('div');
              panel.id = 'notifPanel';
              panel.className = 'notify-panel';
              panel.innerHTML = `
                <div class="p-4">
                  <h4 class="text-sm font-bold mb-2">Recent notifications</h4>
                  <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">No notifications</p>
                  <div class="mt-3 text-right"><button id="notifCloseBtn" class="text-xs text-text-secondary-light">Close</button></div>
                </div>`;
              document.body.appendChild(panel);
              const rect = notifyBtn.getBoundingClientRect();
              panel.style.position = 'fixed';
              panel.style.top = `${rect.bottom + 8}px`;
              panel.style.right = '16px';
              show(panel);
              const closeBtn = panel.querySelector('#notifCloseBtn');
              on(closeBtn, 'click', (ev) => { ev.preventDefault(); ev.stopPropagation(); hide(panel); });
          } else {
              if (panel.style.display === 'none' || !panel.style.display) show(panel); else hide(panel);
          }
      });
  }
}

function openSettings() {
    // ... Settings logic from original dashboard.js ...
    // Re-implementing briefly for completeness as it was part of dashboard.js
    const backdrop = document.getElementById('modalBackdrop');
    const container = document.getElementById('settingsModalContainer');
    if (!container) return;
    let panel = document.getElementById('settingsPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'settingsPanel';
        panel.className = 'fixed inset-0 z-50 flex items-center justify-center pointer-events-none';
        container.appendChild(panel);
    }
    panel.innerHTML = `
      <div class="pointer-events-auto relative w-[640px] h-[480px] bg-white dark:bg-surface-dark rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div class="w-48 flex-shrink-0 bg-gray-50 dark:bg-black/20 border-r border-gray-100 dark:border-gray-700/50 flex flex-col">
          <div class="p-4 pb-2"><h2 class="text-sm font-bold px-2">Settings</h2></div>
          <nav class="flex-1 px-2 py-2 space-y-0.5">
             <button data-tab="general" class="settings-tab-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium bg-gray-200 dark:bg-white/10 text-primary">General</button>
             <button data-tab="notifications" class="settings-tab-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-secondary-light">Notifications</button>
          </nav>
          <div class="p-3 border-t border-gray-100"><button id="settingsCloseBtn" class="w-full py-1.5 rounded-lg text-xs font-medium text-text-secondary-light hover:bg-gray-200">Close</button></div>
        </div>
        <div class="flex-1 flex flex-col h-full overflow-hidden bg-surface-light dark:bg-surface-dark">
           <div id="tab-content-general" class="settings-tab-content flex-1 p-6 overflow-y-auto">
              <h3 class="text-sm font-bold mb-4">General</h3>
              <div><label class="block text-xs font-medium mb-2">Appearance</label>
                   <select id="themeSelect" class="w-full h-9 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 text-xs px-3"><option value="light">Light</option><option value="dark">Dark</option></select>
              </div>
           </div>
        </div>
      </div>`;
    show(backdrop);
    show(panel);
    
    const closeBtn = document.getElementById('settingsCloseBtn');
    if (closeBtn) on(closeBtn, 'click', () => { hide(panel); hide(backdrop); });
    on(backdrop, 'click', () => { hide(panel); hide(backdrop); });
    
    // Theme toggle
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        const html = document.documentElement;
        themeSelect.value = html.classList.contains('dark') ? 'dark' : 'light';
        themeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'dark') { html.classList.add('dark'); html.classList.remove('light'); localStorage.setItem('theme', 'dark'); }
            else { html.classList.remove('dark'); html.classList.add('light'); localStorage.setItem('theme', 'light'); }
        });
    }
}
