import { $, $$, fadeIn, slideToggle, on, openModal, closeModal, show, hide, mountHTML, delegate, openConfirm, openTextPrompt, openInfoModal } from "/src/js/utils/dom.js";
import storageAdapter from "/src/js/storage/storageAdapter.js";
import { normalizeUrl } from "/src/js/utils/url.js";
import { USER_ID, DIGEST_TYPE, LIMITS, COOLDOWN } from "/src/js/config/constants.js";
import { createCard } from "/src/js/templates/card.js";
import { createDigestCard } from "/src/js/templates/digestCard.js";
import { escapeHTML, getTagClass, buildIconHTML } from "/src/js/utils/ui-helpers.js";
import { linkController } from "/src/js/controllers/linkController.js";
import { syncLoop } from "/src/js/sync/syncAgent.js";
import { digestController } from "/src/js/controllers/digestController.js";
import * as linksView from "/src/js/views/linksView.js";
import * as digestView from "/src/js/views/digestView.js";
import * as sendLogsView from "/src/js/views/sendLogsView.js";
import { mountUserWelcomeCard } from "/src/js/components/user-welcome-card.js";
import { mountSubscriptionSettings } from "/src/js/components/settings-panel.js";

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
    // 中文注释：初始化 Links 与 Digest 视图容器
    // Links 视图容器固定为 #cardsContainer
    linksView.initLinksView({ ...context, containerEl: document.getElementById('cardsContainer') });

    // Digest 视图不再清空 <main>，改为挂载到独立容器 #digestSection，避免与 Chat/RuneSpace 互相叠加
    let digestSection = document.getElementById('digestSection');
    if (!digestSection && mainEl) {
        digestSection = document.createElement('section');
        digestSection.id = 'digestSection';
        digestSection.className = 'hidden p-6';
        // 默认插入在 Links 视图之后，保持层级一致
        const linksViewContainer = document.getElementById('linksViewContainer');
        if (linksViewContainer && linksViewContainer.parentElement === mainEl) {
            mainEl.appendChild(digestSection);
        } else {
            mainEl.appendChild(digestSection);
        }
    }
    digestView.initDigestView({ ...context, containerEl: digestSection });
    // 中文注释：初始化发送历史视图容器，占位，登录后可访问
    let sendLogsSection = document.getElementById('sendLogsSection');
    if (!sendLogsSection && mainEl) {
        sendLogsSection = document.createElement('section');
        sendLogsSection.id = 'sendLogsSection';
        sendLogsSection.className = 'hidden p-6';
        mainEl.appendChild(sendLogsSection);
    }
    sendLogsView.initSendLogsView({ containerEl: sendLogsSection, utils: { dom: { $, $$, fadeIn, slideToggle, on, openModal, closeModal, show, hide, mountHTML, delegate, openConfirm, openTextPrompt, openInfoModal }, config: { supabaseUrl: import.meta?.env?.VITE_SUPABASE_URL || '' }, supabaseClient: { getAuthHeaders: async () => {
        // 中文注释：复用统一封装的认证头
        const mod = await import('../services/supabaseClient.js');
        return mod.getAuthHeaders();
    } } } });
    
    // Phase 3: Partial Update - Inject View into Controller
    linkController.setView(linksView);
    digestController.setView(digestView);

    // Bind Events Once
    linksView.bindLinksEvents();

    // Welcome Card Initialization (Run Once)
    loadWelcomeCard();

    // 初始渲染：Mock 模式默认进入 Links 视图，便于直接看到 mock 数据
    // 非 Mock 模式保持原先进入 RuneSpace 视图的行为
    try {
      const cfgMod = await import('../services/config.js');
      const isMock = Boolean(cfgMod.default?.useMock || cfgMod.config?.useMock);
      if (isMock) {
        await renderDefaultMain();
      } else {
        renderRuneSpaceView();
      }
    } catch {
      renderRuneSpaceView();
    }

    // 启动后台同步循环（在线时定期推送变更）
    try { syncLoop(); } catch {}
  })();

  // 中文注释：抽取 Welcome Card 加载逻辑，供 renderRuneSpaceView 复用
  function loadWelcomeCard() {
      // 中文注释：采用旧版设计模板，统一由组件模块挂载与填充数据
      const welcomeContainer = document.getElementById('userWelcomeCard');
      if (!welcomeContainer) return;
      try { mountUserWelcomeCard(welcomeContainer); } catch {}
  }

  const mainEl = document.querySelector('main');
  const defaultMainHTML = mainEl ? mainEl.innerHTML : '';
  
  // ... (lines 91-178 skipped) ...

  function renderRuneSpaceView() {
    if (!mainEl) return;
    
    // 1. Ensure Welcome Card is loaded/refreshed
    loadWelcomeCard();

    // 2. Hide other views
    const runeView = document.getElementById('runeSpaceView');
    const linksView = document.getElementById('linksViewContainer');
    const digestSection = document.getElementById('digestSection');
    const chatView = document.getElementById('chatSection');
    const sendLogsSection = document.getElementById('sendLogsSection');
    // 隐藏非 RuneSpace 的其他视图
    if (linksView) hide(linksView);
    if (digestSection) hide(digestSection);
    if (chatView) hide(chatView);
    if (sendLogsSection) hide(sendLogsSection);

    if (runeView) show(runeView);
    
    // Highlight nav
    highlightNav('navRuneSpace');
  }

  function renderDefaultMain() {
    if (mainEl) {
      // Cleanup other scrolls
      digestView.disableInfiniteScroll();

      // Restore Links View
      const runeView = document.getElementById('runeSpaceView');
      const linksViewContainer = document.getElementById('linksViewContainer');
      const digestSection = document.getElementById('digestSection');
      const chatView = document.getElementById('chatSection');
      const sendLogsSection = document.getElementById('sendLogsSection');
      
      if (runeView) hide(runeView);
      if (linksViewContainer) show(linksViewContainer);
      if (digestSection) hide(digestSection);
      if (chatView) hide(chatView);
      if (sendLogsSection) hide(sendLogsSection);
      
      // 保持 Chat 视图容器但隐藏，避免反复创建/销毁

      // Update container reference for LinksView as DOM changed (or just re-init logic)
      // Since we are toggling visibility, we don't need to re-mount HTML.
      // But we do need to ensure linksView is active controller.
      
      linksView.initLinksView({ 
          containerEl: document.getElementById('cardsContainer'), 
          controllers: { linkController, digestController },
          templates: { createCard, createDigestCard },
          utils: { dom: {$,$$,fadeIn,slideToggle,on,openModal,closeModal,show,hide,mountHTML,delegate,openConfirm,openTextPrompt,openInfoModal}, storageAdapter }
      });
      linkController.setView(linksView);
      
      highlightNav('linksGroupHeader'); // Or find the "All Links" item?

      // Phase 3: Pagination (Load Page 0) if empty?
      // Check if already loaded?
      const container = document.getElementById('cardsContainer');
      if (container && container.children.length === 0) {
          return linkController.fetchPage(0, 20).then(({ items }) => {
              linksView.renderLinks(items);
              // Enable Infinite Scroll
              const scrollContainer = document.getElementById('mainScrollContainer');
              linksView.enableInfiniteScroll(scrollContainer, {
                  onLoadMore: () => linkController.loadNextPage()
              });
          });
      }
    }
    return Promise.resolve();
  }
  // 中文注释：暴露“返回 All Links 视图”的导航方法，供侧栏分类点击时调用（Digest 等其他视图切回 Links）
  try { window.navigateToLinks = renderDefaultMain; } catch {}
  
  function highlightNav(id) {
      $$('.nav-item, #linksGroupHeader, #aiGroupHeader').forEach(el => el.classList.remove('bg-gray-200', 'dark:bg-white/20', 'text-primary'));
      const el = document.getElementById(id);
      if (el) el.classList.add('bg-gray-200', 'dark:bg-white/20', 'text-primary');
  }

  // Navigation Logic
  const navRuneSpace = document.getElementById('navRuneSpace');
  if (navRuneSpace) on(navRuneSpace, 'click', (e) => {
      e.preventDefault();
      renderRuneSpaceView();
  });

  const navDigest = document.getElementById('navDigest');
  const navChat = document.getElementById('navChat');
  const navSendLogs = document.getElementById('navSendLogs');
  const navLinks = document.querySelector('.nav-item[href="#"]'); // Assuming Home/Links is default
  
  // ...
  
  // For now, let's assume clicking "Digest" switches view.
  if (navDigest) on(navDigest, 'click', (e) => { 
      e.preventDefault(); 
      // 中文注释：切换到 Digest 视图时，统一隐藏其他视图
      const runeView = document.getElementById('runeSpaceView');
      const linksViewContainer = document.getElementById('linksViewContainer');
      const chatView = document.getElementById('chatSection');
      const digestSection = document.getElementById('digestSection');
      const sendLogsSection = document.getElementById('sendLogsSection');
      if (runeView) hide(runeView);
      if (linksViewContainer) hide(linksViewContainer);
      if (chatView) hide(chatView);
      if (sendLogsSection) hide(sendLogsSection);
      if (digestSection) show(digestSection);

      // 中文注释：清理 hash，避免 #/send-logs 残留导致后续误触发渲染
      try { if (window.location.hash) window.location.hash = ''; } catch {}

      linksView.disableInfiniteScroll();
      digestView.renderDigests().then(() => {
          const scrollContainer = document.getElementById('mainScrollContainer');
          digestView.enableInfiniteScroll(scrollContainer, {
              onLoadMore: () => digestController.loadNextPage()
          });
          highlightNav('navDigest');
      });
  });

  // 中文注释：发送历史视图（登录守卫）
  function renderSendLogsRoute() {
      const user = storageAdapter.getUser();
      if (!user || !user.id) {
      openInfoModal({ title: 'Unauthorized', message: '请先登录后访问发送历史。' });
          try { window.location.href = 'index.html'; } catch {}
          return;
      }
      const runeView = document.getElementById('runeSpaceView');
      const linksViewContainer = document.getElementById('linksViewContainer');
      const digestSection = document.getElementById('digestSection');
      const chatView = document.getElementById('chatSection');
      const sendLogsSection = document.getElementById('sendLogsSection');
      if (runeView) hide(runeView);
      if (linksViewContainer) hide(linksViewContainer);
      if (digestSection) hide(digestSection);
      if (chatView) hide(chatView);
      if (sendLogsSection) show(sendLogsSection);
      sendLogsView.renderSendLogs();
      highlightNav('navSendLogs');
  }
  if (navSendLogs) on(navSendLogs, 'click', (e) => { 
      e.preventDefault(); 
      try { window.location.hash = '#/send-logs'; } catch {}
      renderSendLogsRoute(); 
  });

  // 中文注释：Hash 路由集成（#/send-logs）
  window.addEventListener('hashchange', () => {
      if (window.location.hash === '#/send-logs') renderSendLogsRoute();
  });
  // 首次加载根据 hash 渲染
  if (window.location.hash === '#/send-logs') renderSendLogsRoute();
  
  // We need a way to go back to Links. 
   // The "Links" header or items inside it.
  const linksHeader = document.getElementById('linksGroupHeader');
  const linksBody = document.getElementById('linksGroupBody');
  if (linksHeader && linksBody) {
      // 中文注释：初始化折叠状态标记，0=展开，1=折叠；避免首击判断错误
      if (!linksBody.dataset.collapsed) linksBody.dataset.collapsed = '0';
      // 点击标题：切换视图 + 切换折叠状态
      on(linksHeader, 'click', (e) => {
          e.preventDefault();
          // 中文注释：模态期间禁止侧栏交互
          if (document.body?.dataset?.modalOpen === '1') return;
          
          // 1. 切换到 Links 视图 (如果当前不在)
          const linksContainer = document.getElementById('linksViewContainer');
          const isViewHidden = !linksContainer || linksContainer.classList.contains('hidden');
          
          if (isViewHidden) {
              renderDefaultMain();
              // 中文注释：强制展开并在动画结束后清理内联样式，避免“首击覆盖/拉伸多次才恢复”问题
              linksBody.style.transition = `max-height 200ms ease-in-out, opacity 200ms ease-in-out`;
              linksBody.style.maxHeight = linksBody.scrollHeight + "px";
              linksBody.style.display = "";
              linksBody.style.opacity = "1";
              linksBody.style.overflow = "hidden";
              linksBody.dataset.collapsed = '0';
              setTimeout(() => {
                  if (linksBody.dataset.collapsed === '0') {
                      linksBody.style.maxHeight = '';
                      linksBody.style.overflow = '';
                      linksBody.style.transition = '';
                  }
              }, 220);
              
              // 旋转图标向下
              const icon = linksHeader.querySelector('.material-symbols-outlined');
              if (icon) {
                  icon.style.transform = 'rotate(0deg)';
                  icon.style.transition = 'transform 0.2s ease';
              }
              return; // 结束，不执行 toggle
          }
          
          // 2. 如果已经在 Links 视图，则执行折叠切换 (依据数据状态)
          const willCollapse = linksBody.dataset.collapsed !== '1' && linksBody.offsetHeight > 0;
          slideToggle(linksBody);
          linksBody.dataset.collapsed = willCollapse ? '1' : '0';
          
          // 3. 旋转图标（基于目标状态）
          const icon = linksHeader.querySelector('.material-symbols-outlined');
          if (icon) {
              icon.style.transform = willCollapse ? 'rotate(-90deg)' : 'rotate(0deg)';
              icon.style.transition = 'transform 0.2s ease';
          }
      });
  }
  const aiHeader = document.getElementById('aiGroupHeader');
   const aiBody = document.getElementById('aiGroupBody');
   if (aiHeader && aiBody) {
       on(aiHeader, 'click', (e) => {
           e.preventDefault();
            // 中文注释：模态期间阻止 AI Features 折叠/展开，避免覆盖 New Category 区域
            if (document.body?.dataset?.modalOpen === '1') return;
           slideToggle(aiBody);
           const icon = aiHeader.querySelector('.material-symbols-outlined');
           if (icon) {
               if (aiBody.style.maxHeight === '0px') {
                   icon.style.transform = 'rotate(-90deg)';
               } else {
                   icon.style.transform = 'rotate(0deg)';
               }
               icon.style.transition = 'transform 0.2s ease';
           }
       });
   }

    if (logoBtn) on(logoBtn, 'click', renderRuneSpaceView); // Logo goes home (Rune Space)

  // Chat View (Placeholder)
  if (navChat) on(navChat, 'click', (e) => { 
      e.preventDefault(); 
      renderChatView(); 
      highlightNav('navChat');
  });

  function renderChatView() {
    if (!mainEl) return;
    // 中文注释：统一隐藏其他视图（RuneSpace / Links / Digest）
    const runeView = document.getElementById('runeSpaceView');
    const linksView = document.getElementById('linksViewContainer');
    const digestSection = document.getElementById('digestSection');
    if (runeView) hide(runeView);
    if (linksView) hide(linksView);
    if (digestSection) hide(digestSection);
    const sendLogsSection = document.getElementById('sendLogsSection');
    if (sendLogsSection) hide(sendLogsSection);

    // Mount chat
    let chatSection = document.getElementById('chatSection');
    if (!chatSection) {
        chatSection = document.createElement('section');
        chatSection.id = 'chatSection';
        chatSection.className = 'p-6';
        chatSection.innerHTML = `
        <div class="mb-4">
          <h1 class="text-2xl font-bold">Chat / AI Assistant</h1>
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">Chat with AI (placeholder).</p>
        </div>
        <div class="flex gap-2">
          <input id="chatInput" class="form-input flex-1 rounded-lg bg-gray-100 dark:bg-white/5 border-none" placeholder="Type a message…" />
          <button id="chatSend" class="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold">Send</button>
        </div>
        <div id="chatList" class="mt-4 flex flex-col gap-2"></div>
      `;
      mainEl.appendChild(chatSection);
    }
    show(chatSection);
    
    // ... Chat logic ...
  }

  // User Welcome & Dropdown
  loadUserWelcome();

  // 中文注释：登录可见的导航项（Send Logs），未登录时隐藏
  const user = storageAdapter.getUser();
  const sendLogsNavEl = document.getElementById('navSendLogs');
  if (sendLogsNavEl) {
     if (!user || !user.id || user.id === 'local-dev') {
        // 开发模式下 local-dev 也显示，生产未登录隐藏
        const isDev = import.meta?.env?.MODE !== 'production';
        sendLogsNavEl.style.display = isDev ? '' : 'none';
     } else {
        sendLogsNavEl.style.display = '';
     }
  }
  
  function loadUserWelcome() {
    const user = storageAdapter.getUser();
    const userName = user?.nickname || 'Developer';
    const userId = user?.id || 'local-dev';
    const userAvatar = user?.avatar || 'https://i.pravatar.cc/100?img=12';
    
    // 修复：不再移除 #userWelcomeCard 容器，避免 WelcomeCard 无法渲染
    // 旧逻辑会误删容器，导致 loadWelcomeCard() 找不到目标
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
      const profileBtn = document.getElementById('profileBtn');
      if (profileBtn) on(profileBtn, 'click', () => {
           menu.classList.remove('show');
           openSettings('profile');
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

async function openSettings(defaultTab = 'general') {
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
             <button data-tab="profile" class="settings-tab-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-secondary-light">Profile</button>
             <button data-tab="general" class="settings-tab-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium bg-gray-200 dark:bg-white/10 text-primary">General</button>
             <button data-tab="subscription" class="settings-tab-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-secondary-light">Subscription Settings</button>
             <button data-tab="account" class="settings-tab-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-secondary-light">Account</button>
          </nav>
          <div class="p-3 border-t border-gray-100"><button id="settingsCloseBtn" class="w-full py-1.5 rounded-lg text-xs font-medium text-text-secondary-light hover:bg-gray-200">Close</button></div>
        </div>
        <div class="flex-1 flex flex-col h-full overflow-hidden bg-surface-light dark:bg-surface-dark">
           <div id="tab-content-profile" class="settings-tab-content flex-1 p-6 overflow-y-auto hidden"></div>
           <div id="tab-content-general" class="settings-tab-content flex-1 p-6 overflow-y-auto">
              <h3 class="text-sm font-bold mb-4">General</h3>
              <div><label class="block text-xs font-medium mb-2">Appearance</label>
                   <select id="themeSelect" class="w-full h-9 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 text-xs px-3"><option value="light">Light</option><option value="dark">Dark</option></select>
              </div>
           </div>
           <div id="tab-content-subscription" class="settings-tab-content flex-1 p-0 overflow-y-auto hidden"></div>
           <div id="tab-content-account" class="settings-tab-content flex-1 p-6 overflow-y-auto hidden"></div>
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

    // 中文注释：挂载订阅设置面板
    const subContainer = document.getElementById('tab-content-subscription');
    if (subContainer) {
        try { mountSubscriptionSettings(subContainer); } catch (e) { console.warn('[Settings] mount subscription failed', e); }
    }
    const profileContainer = document.getElementById('tab-content-profile');
    if (profileContainer) {
        try { const { mountProfileSettings } = await import('../features/account_settings.js'); mountProfileSettings(profileContainer); } catch (e) { console.warn('[Settings] mount profile failed', e); }
    }
    const accountContainer = document.getElementById('tab-content-account');
    if (accountContainer) {
        try { const { mountAccountSettings } = await import('../features/account_settings.js'); mountAccountSettings(accountContainer); } catch (e) { console.warn('[Settings] mount account failed', e); }
    }

    // Tab 切换
    const tabs = Array.from(panel.querySelectorAll('.settings-tab-btn'));
    tabs.forEach(btn => {
        on(btn, 'click', () => {
            tabs.forEach(b => b.classList.remove('bg-gray-200','dark:bg-white/10','text-primary'));
            btn.classList.add('bg-gray-200','dark:bg-white/10','text-primary');
            const key = btn.dataset.tab;
            panel.querySelectorAll('.settings-tab-content').forEach(c => c.classList.add('hidden'));
            const target = document.getElementById(`tab-content-${key}`);
            if (target) target.classList.remove('hidden');
        });
    });

    // Auto-switch to requested tab
    if (defaultTab && defaultTab !== 'general') {
        const btn = panel.querySelector(`.settings-tab-btn[data-tab="${defaultTab}"]`);
        if (btn) btn.click();
    }
}
