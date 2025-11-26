
import { $, $$, fadeIn, slideToggle, on, openModal, closeModal, show, hide, mountHTML, delegate } from "../utils/dom.js";
// 中文注释：使用项目根目录的 mock 函数，保持接口不变
import { mockAIFromUrl as mockAIFromUrlExternal } from "../../mockFunctions.js";

// =============================
// 🎴 统一卡片模板与辅助函数
// =============================

// 中文注释：安全转义 HTML，避免插入恶意脚本
function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 中文注释：根据标签关键字返回 Tailwind 颜色类（浅色与深色模式兼容）
function getTagClass(tag = "") {
  const t = tag.toLowerCase();
  if (/(^|\b)(ai|research)(\b|$)/.test(t)) return "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300";
  if (/(^|\b)(design|ux)(\b|$)/.test(t)) return "bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-300";
  if (/(^|\b)(productivity)(\b|$)/.test(t)) return "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-300";
  if (/(^|\b)(development|dev)(\b|$)/.test(t)) return "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300";
  return "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300";
}

// 中文注释：构建卡片图标（优先 favicon，可回退为标题首字符）
function buildIconHTML({ title = "", url = "" } = {}) {
  const initial = (title || url || "U").trim().charAt(0).toUpperCase() || "U";
  // 简化：直接使用首字符方块；如需 favicon 可替换为 img 标签（保留注释说明）
  return `
    <div class="rune-card-icon w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center text-base font-bold">
      ${escapeHTML(initial)}
    </div>
  `;
}

// 中文注释：统一卡片模板，返回完整 HTML 字符串
export function createCard(data = {}) {
  const { title = "Untitled", description = "由 AI 自动生成的摘要占位…", category = "", tags = [], url = "" } = data;
  const tagsHtml = (Array.isArray(tags) ? tags : []).map((raw) => {
    const label = String(raw).trim();
    const colorCls = getTagClass(label);
    return `<span class="rune-tag ${colorCls}">${escapeHTML(label)}</span>`;
  }).join("");

  return `
    <div class="rune-card group rounded-xl border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-surface-dark p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition">
      <div class="rune-card-head flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          ${buildIconHTML({ title, url })}
          <div class="rune-card-title text-base font-bold">${escapeHTML(title)}</div>
        </div>
        <button class="more-btn material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark" title="更多">more_horiz</button>
      </div>
      <div class="rune-card-desc text-sm mt-2 text-text-secondary-light dark:text-text-secondary-dark">${escapeHTML(description)}</div>
      <div class="rune-card-divider my-3"></div>
      <div class="rune-card-tags flex flex-wrap gap-2">
        ${tagsHtml}
      </div>
    </div>
  `;
}

// =============================
// 💾 本地存储与数据模型（localStorage）
// =============================

// 中文注释：生成稳定唯一 id（时间戳+随机段）
function generateId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// 中文注释：存储键名约定
const STORAGE_KEYS = { cards: 'rune_cards', categories: 'rune_categories' };

// 中文注释：内存数据结构
let cards = [];
const cardsMap = new Map();
let categories = [];

// 中文注释：读取/写入 localStorage（带回退）
function loadFromStorage(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function saveToStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

function persistCards() { saveToStorage(STORAGE_KEYS.cards, cards); }
function persistCategories() { saveToStorage(STORAGE_KEYS.categories, categories); }

// 中文注释：添加卡片到内存并持久化
function addCardToStore(card) {
  cards.unshift(card);
  cardsMap.set(card.id, card);
  persistCards();
  ensureCategory(card.category);
}

// 中文注释：更新卡片内容并持久化
function updateCardInStore(id, patch) {
  const idx = cards.findIndex(c => c.id === id);
  if (idx !== -1) {
    cards[idx] = { ...cards[idx], ...patch };
    cardsMap.set(id, cards[idx]);
    persistCards();
  }
}

// 中文注释：从内存与存储中删除卡片
function deleteCardFromStore(id) {
  cards = cards.filter(c => c.id !== id);
  cardsMap.delete(id);
  persistCards();
}

// 中文注释：确保分类存在，不存在则新增并持久化与侧栏同步
function ensureCategory(name) {
  const n = String(name || '').trim();
  if (!n) return;
  if (!categories.includes(n)) {
    categories.push(n);
    persistCategories();
    renderCategoriesSidebar();
    syncEditCategorySelect();
  }
}

// 中文注释：侧栏分类渲染（与删除按钮）
function renderCategoriesSidebar() {
  const list = document.getElementById('linksGroupList');
  if (!list) return;
  list.innerHTML = '';
  categories.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5';
    item.innerHTML = `
      <span class="text-sm font-medium">${escapeHTML(cat)}</span>
      <button class="category-delete text-xs text-text-secondary-light dark:text-text-secondary-dark">删除</button>
    `;
    list.appendChild(item);
  });
}

// 中文注释：Edit 模态下拉同步当前分类（支持新增）
function syncEditCategorySelect() {
  const sel = document.getElementById('editLinkCategory');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select Category</option>' + categories.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('') + '<option value="__new__">+ 新增分类…</option>';
}

// 中文注释：从 URL 模拟生成 AI 元数据（标题/摘要/类别/标签）
// 中文注释：移除本地 mock，实现统一从 mockFunctions.js 引入；保留 createCard 作为模板构建函数

export function initDashboard() {
  console.log("📊 Dashboard initialized");

  // 缓存默认主内容 HTML，以便在视图切换后恢复
  const mainEl = document.querySelector('main');
  const defaultMainHTML = mainEl ? mainEl.innerHTML : '';

  // ====== Logo 按钮：返回首页 ======
  const logoBtn = document.getElementById("logoBtn");
  if (logoBtn) {
    // 中文注释：点击品牌按钮返回首页（index.html），用于从 Dashboard 回到入口
    on(logoBtn, "click", () => {
      window.location.href = "index.html";
    });
  }

  // ====== 折叠侧栏 ======
  const toggle = document.getElementById("sidebarToggle");
  const sidebar = document.querySelector(".sidebar");
  if (toggle && sidebar) {
    toggle.addEventListener("click", () => {
      sidebar.classList.toggle("aside-collapsed");
    });
  }

  // ====== 折叠导航分组 ======
  const navGroups = [
    { header: "linksGroupHeader", body: "linksGroupBody" },
    { header: "aiGroupHeader", body: "aiGroupBody" },
    { header: "userGroupHeader", body: "userGroupBody" },
  ];

  // 中文注释：将折叠逻辑替换为 slideToggle，提供更柔和的视觉反馈；移除直接操作 hidden 类与图标切换，由 CSS 过渡与布局承担体验。
  navGroups.forEach(({ header, body }) => {
    const h = document.getElementById(header);
    const b = document.getElementById(body);
    if (h && b) {
      // 初始化：设置 max-height 以便动画计算
      b.style.overflow = "hidden"; // 防止内容溢出影响动画
      b.style.maxHeight = b.scrollHeight + "px";
      h.addEventListener("click", () => {
        slideToggle(b);
      });
    }
  });

  // ====== 点击菜单高亮 ======
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      navItems.forEach((i) => i.classList.remove("active-item"));
      item.classList.add("active-item");
    });
  });

  // ====== 视图切换：Digest 与 Chat 占位 ======
  function renderDefaultMain() {
    if (mainEl) {
      mainEl.innerHTML = defaultMainHTML;
    }
  }
  function renderDigestView() {
    if (!mainEl) return;
    mountHTML(mainEl, `
      <section class="p-6">
        <div class="mb-4">
          <h1 class="text-2xl font-bold">AI Digest</h1>
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">近期链接的自动摘要将在此展示（占位）。</p>
        </div>
        <button id="backToLinks" class="h-10 px-4 rounded-lg bg-gray-100 dark:bg-white/10 text-sm font-semibold">返回 All Links</button>
      </section>
    `);
    const backBtn = document.getElementById('backToLinks');
    if (backBtn) on(backBtn, 'click', renderDefaultMain);
  }
  function renderChatView() {
    if (!mainEl) return;
    mountHTML(mainEl, `
      <section class="p-6">
        <div class="mb-4">
          <h1 class="text-2xl font-bold">Chat / AI Assistant</h1>
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">与 AI 的对话区域（占位）。</p>
        </div>
        <div class="flex gap-2">
          <input id="chatInput" class="form-input flex-1 rounded-lg bg-gray-100 dark:bg-white/5 border-none" placeholder="输入消息…" />
          <button id="chatSend" class="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold">发送</button>
        </div>
        <div id="chatList" class="mt-4 flex flex-col gap-2"></div>
        <button id="backToLinks2" class="mt-6 h-10 px-4 rounded-lg bg-gray-100 dark:bg-white/10 text-sm font-semibold">返回 All Links</button>
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
        me.textContent = `你：${text}`;
        const ai = document.createElement('div');
        ai.className = 'text-sm text-text-secondary-light dark:text-text-secondary-dark';
        ai.textContent = 'AI：这是占位回复';
        chatList.append(me, ai);
        chatInput.value = '';
      });
    }
    const backBtn2 = document.getElementById('backToLinks2');
    if (backBtn2) on(backBtn2, 'click', renderDefaultMain);
  }
  const navDigest = document.getElementById('navDigest');
  const navChat = document.getElementById('navChat');
  const navSettings = document.getElementById('navSettings');
  if (navDigest) on(navDigest, 'click', (e) => { e.preventDefault(); renderDigestView(); });
  if (navChat) on(navChat, 'click', (e) => { e.preventDefault(); renderChatView(); });
  if (navSettings) on(navSettings, 'click', (e) => {
    e.preventDefault();
    // 中文注释：打开设置弹窗，占位内容；使用页面已有的 modalBackdrop 作为遮罩
    const backdrop = document.getElementById('modalBackdrop');
    const container = document.getElementById('settingsModalContainer');
    if (!container) return;
    let panel = document.getElementById('settingsPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'settingsPanel';
      panel.className = 'fixed inset-0 z-50 flex items-center justify-center';
      panel.innerHTML = `
        <div class="relative w-full max-w-lg rounded-xl bg-surface-light dark:bg-surface-dark shadow-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-xl font-bold mb-4">Settings</h3>
          <div class="grid grid-cols-1 gap-3">
            <label class="text-sm">主题
              <select class="form-select mt-1 w-full rounded-lg bg-gray-100 dark:bg-white/5 border-none">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label class="text-sm">邮箱通知
              <input type="checkbox" class="form-checkbox ml-2" />
            </label>
          </div>
          <div class="mt-5 flex justify-end gap-3">
            <button id="settingsCloseBtn" class="h-10 px-4 rounded-lg bg-gray-100 dark:bg-white/10 text-sm font-semibold">关闭</button>
          </div>
        </div>`;
      container.appendChild(panel);
    }
    show(backdrop);
    show(panel);
    const closeBtn = document.getElementById('settingsCloseBtn');
    if (closeBtn) on(closeBtn, 'click', () => { hide(panel); hide(backdrop); });
    on(backdrop, 'click', () => { hide(panel); hide(backdrop); });
  });

  // ====== 通用确认模态封装 ======
  function openConfirm({ title = '确认操作？', message = '此操作无法撤销。', onOk = () => {} } = {}) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const btnCancel = document.getElementById('confirmCancel');
    const btnOk = document.getElementById('confirmOk');
    if (!modal || !titleEl || !msgEl || !btnCancel || !btnOk) return;
    titleEl.textContent = title;
    msgEl.textContent = message;
    show(modal);
    const cleanup = () => {
      hide(modal);
      btnCancel.removeEventListener('click', onCancel);
      btnOk.removeEventListener('click', onConfirm);
    };
    const onCancel = () => cleanup();
    const onConfirm = () => { try { onOk(); } finally { cleanup(); } };
    btnCancel.addEventListener('click', onCancel);
    btnOk.addEventListener('click', onConfirm);
  }

  // ====== 顶栏通知按钮：打开简单通知面板 ======
  // 中文注释：页面未提供通知容器，这里通过查询顶栏内的按钮图标为 notifications 的按钮进行绑定
  const headerButtons = Array.from(document.querySelectorAll('header button'));
  const notifyBtn = headerButtons.find((btn) => btn.querySelector('.material-symbols-outlined')?.textContent?.trim() === 'notifications');
  if (notifyBtn) {
    on(notifyBtn, 'click', () => {
      // 构建一个临时通知面板（靠近按钮定位），再次点击或点击外部关闭
      let panel = document.getElementById('notifPanel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'notifPanel';
        panel.className = 'user-dropdown show';
        panel.innerHTML = `
          <div class="p-4">
            <h4 class="text-sm font-bold mb-2">最近通知</h4>
            <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">暂无通知</p>
            <div class="mt-3 text-right">
              <button id="notifCloseBtn" class="text-xs text-text-secondary-light dark:text-text-secondary-dark">关闭</button>
            </div>
          </div>`;
        document.body.appendChild(panel);
        // 简单定位：跟随按钮在视窗右上区域
        const rect = notifyBtn.getBoundingClientRect();
        panel.style.position = 'fixed';
        panel.style.top = `${rect.bottom + 8}px`;
        panel.style.right = '16px';
        const closeBtn = panel.querySelector('#notifCloseBtn');
        on(closeBtn, 'click', () => hide(panel));
        // 外部点击关闭
        const onDocClick = (e) => {
          if (!panel.contains(e.target) && e.target !== notifyBtn) {
            hide(panel);
            document.removeEventListener('click', onDocClick);
          }
        };
        setTimeout(() => document.addEventListener('click', onDocClick), 0);
      } else {
        // 切换显示
        panel.classList.toggle('show');
        if (!panel.classList.contains('show')) hide(panel); else show(panel);
      }
    });
  }

  // ====== 初始化用户卡片（避免重复注入） ======
  const card = document.getElementById("userWelcomeCard");
  if (card) {
    card.innerHTML = `
      <div class="user-welcome-card">
        <h2 class="text-lg font-bold mb-1">晚上好，<span class="text-primary">SoloDev</span> 👋</h2>
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">今天是个充满灵感的夜晚。</p>
      </div>`;
  }

  // ====== Add Link 模态：打开/关闭/保存 ======
  const addLinkBtn = document.getElementById('addLinkBtn');
  const addLinkModal = document.getElementById('addLinkModal');
  const cancelAddLinkBtn = document.getElementById('cancelAddLinkBtn');
  const saveLinkBtn = document.getElementById('saveLinkBtn');
  const closeModalX = document.getElementById('closeModalX');
  const inpUrl = document.getElementById('inpUrl');
  const cardsContainer = document.getElementById('cardsContainer');

  if (addLinkBtn && addLinkModal) {
    // 中文注释：打开添加链接模态
    on(addLinkBtn, 'click', () => openModal(addLinkModal));
  }
  if (cancelAddLinkBtn && addLinkModal) {
    // 中文注释：取消关闭模态
    on(cancelAddLinkBtn, 'click', () => closeModal(addLinkModal));
  }
  if (closeModalX && addLinkModal) {
    // 中文注释：右上角关闭
    on(closeModalX, 'click', () => closeModal(addLinkModal));
  }
  if (saveLinkBtn && addLinkModal && inpUrl && cardsContainer) {
    // 中文注释：保存链接 → 调用 mockFunctions.js 的 mockAIFromUrl(url) → 构建卡片并持久化
    on(saveLinkBtn, 'click', async () => {
      const url = inpUrl.value.trim();
      if (!url) {
        alert('请输入有效的链接 URL');
        return;
      }
      saveLinkBtn.disabled = true; // 防重复提交
      const mock = await mockAIFromUrlExternal(url).catch(() => ({ title: '', description: '', category: 'All Links', tags: ['bookmark'] }));
      const data = {
        id: generateId(),
        title: mock?.title || (url.replace(/^https?:\/\//, '').split('/')[0] || 'Untitled'),
        description: mock?.description || 'Mock: 自动生成的摘要占位。',
        category: mock?.category || 'All Links',
        tags: Array.isArray(mock?.tags) && mock.tags.length ? mock.tags : ['bookmark'],
        url,
      };
      addCardToStore(data);
      const html = createCard(data);
      cardsContainer.insertAdjacentHTML('afterbegin', html);
      inpUrl.value = '';
      closeModal(addLinkModal);
      saveLinkBtn.disabled = false;
    });
  }

  // ====== 搜索框：输入与回车筛选卡片 ======
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
    // 空状态占位
    let emptyEl = document.getElementById('emptyState');
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.id = 'emptyState';
      emptyEl.className = 'text-sm text-text-secondary-light dark:text-text-secondary-dark mt-4';
      emptyEl.textContent = '未找到匹配的链接';
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

  // ===== 动态加载用户数据（未来接 Supabase）=====
  loadUserWelcome();

  // ====== 注入示例卡片，用于自测交互 ======
  function seedDemoCards() {
    const container = document.getElementById('cardsContainer');
    if (!container) return;
    // 中文注释：若本地已有持久化数据，则按存储渲染；否则注入示例并持久化，避免重复注入
    cards = loadFromStorage(STORAGE_KEYS.cards, []);
    categories = loadFromStorage(STORAGE_KEYS.categories, []);
    cardsMap.clear();
    cards.forEach(c => cardsMap.set(c.id, c));
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
    // 中文注释：统一使用 createCard(data) 渲染示例卡片，确保与新增链接的 UI 一致
    const samples = [
      {
        id: generateId(),
        title: 'Figma — Design tool',
        description: 'AI 自动摘要：Figma 是现代设计协作平台，适合原型与 UI 设计。',
        category: 'Design',
        tags: ['Design', 'Productivity'],
        url: 'https://figma.com/',
      },
      {
        id: generateId(),
        title: 'OpenAI — GPT Models',
        description: 'AI 自动摘要：OpenAI 提供先进的大语言模型与 API 接入能力。',
        category: 'AI',
        tags: ['AI', 'Research'],
        url: 'https://openai.com/',
      },
      {
        id: generateId(),
        title: 'GitHub — Code hosting',
        description: 'AI 自动摘要：GitHub 是主流的代码托管与协作平台。',
        category: 'Development',
        tags: ['Development'],
        url: 'https://github.com/',
      },
    ];
    samples.forEach((data) => {
      const html = createCard(data);
      container.insertAdjacentHTML('beforeend', html);
      addCardToStore(data);
      ensureCategory(data.category);
    });
    renderCategoriesSidebar();
    syncEditCategorySelect();
  }
  seedDemoCards();

  // =============================
  // 🧰 卡片更多菜单 + 编辑/删除 事件委托
  // =============================
  if (cardsContainer) {
    // 中文注释：关闭所有卡片菜单（防多开）
    const closeAllMenus = () => {
      const menus = cardsContainer.querySelectorAll('.rune-card-menu');
      menus.forEach(m => m.classList.add('hidden'));
    };

    // 中文注释：点击卡片右上“更多”按钮，打开/关闭菜单
    delegate(cardsContainer, '.more-btn', 'click', (e, btn) => {
      closeAllMenus();
      const card = btn.closest('.rune-card');
      const menu = card?.querySelector('.rune-card-menu');
      if (menu) {
        menu.classList.toggle('hidden');
        // 外部点击与 ESC 关闭
        const onDocClick = (ev) => {
          if (!card.contains(ev.target)) { menu.classList.add('hidden'); document.removeEventListener('click', onDocClick); }
        };
        setTimeout(() => document.addEventListener('click', onDocClick), 0);
        const onEsc = (ev) => { if (ev.key === 'Escape') { menu.classList.add('hidden'); document.removeEventListener('keydown', onEsc); } };
        document.addEventListener('keydown', onEsc, { once: true });
      }
    });

    // 中文注释：编辑操作 → 打开 Edit 模态并预填
    delegate(cardsContainer, '.menu-edit', 'click', (e, btn) => {
      e.stopPropagation();
      const cardEl = btn.closest('.rune-card');
      const id = cardEl?.getAttribute('data-card-id');
      const data = id ? cardsMap.get(id) : null;
      const modal = document.getElementById('editLinkModal');
      if (!data || !modal) return;
      // 预填表单字段
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
      // 打开模态
      openModal(modal);
      // 保存事件（一次性绑定）
      const form = document.getElementById('editLinkForm');
      const cancelBtn = document.getElementById('cancelEditBtn');
      const menu = cardEl.querySelector('.rune-card-menu');
      const onSubmit = (ev) => {
        ev.preventDefault();
        // 读取字段
        const title = fTitle?.value?.trim() || 'Untitled';
        const url = fURL?.value?.trim() || '';
        const description = fDesc?.value?.trim() || '';
        const tagsStr = fTags?.value?.trim() || '';
        const catVal = fCat?.value || '';
        const newCat = fCatNew?.value?.trim() || '';
        const category = catVal === '__new__' ? (newCat || '') : catVal;
        // 校验 URL
        if (!url) { alert('URL 不能为空'); return; }
        // 更新内存与持久化
        const tags = tagsStr ? tagsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        updateCardInStore(id, { title, url, description, tags, category });
        ensureCategory(category);
        // 更新 DOM（保留原位置）：直接替换卡片内部结构
        const updated = cardsMap.get(id);
        if (updated && cardEl) {
          // 渐隐替换优化：避免全移除导致布局抖动
          cardEl.style.transition = 'opacity 120ms ease';
          cardEl.style.opacity = '0.4';
          // 替换内部 HTML
          cardEl.outerHTML = createCard(updated);
        }
        // 关闭菜单与模态
        if (menu) menu.classList.add('hidden');
        closeModal(modal);
        // 成功提示（轻量）
        const ok = document.createElement('div');
        ok.className = 'text-green-600 text-sm mt-2';
        ok.textContent = '已保存';
        document.body.appendChild(ok);
        setTimeout(() => { ok.remove(); }, 1500);
        // 清理绑定
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
      // 类别选择“新增”时显示输入框（使用已声明的 fCat 与 fCatNew，避免重复声明）
      if (fCat) {
        fCat.addEventListener('change', () => {
          if (fCat.value === '__new__') fCatNew?.classList.remove('hidden');
          else fCatNew?.classList.add('hidden');
        }, { once: true });
      }
    });

    // 中文注释：删除操作 → 确认后删除 DOM 与内存
    delegate(cardsContainer, '.menu-delete', 'click', (e, btn) => {
      e.stopPropagation();
      const cardEl = btn.closest('.rune-card');
      const id = cardEl?.getAttribute('data-card-id');
      if (!id) return;
      const menu = cardEl.querySelector('.rune-card-menu');
      openConfirm({
        title: '确认删除？',
        message: '删除后不可恢复。',
        onOk: () => {
          // 淡出动画后移除
          cardEl.style.transition = 'opacity 160ms ease';
          cardEl.style.opacity = '0';
          setTimeout(() => { cardEl.remove(); }, 180);
          deleteCardFromStore(id);
          if (menu) menu.classList.add('hidden');
        }
      });
    });
  }

  // ====== 用户头像下拉：展开与收起 ======
  const dropdownContainer = document.getElementById('userDropdownContainer');
  if (dropdownContainer) {
    // 中文注释：构建下拉菜单容器
    let menu = dropdownContainer.querySelector('.user-dropdown');
    if (!menu) {
      menu = document.createElement('div');
      menu.className = 'user-dropdown';
      menu.innerHTML = `
        <ul class="p-2">
          <li><button id="profileBtn" class="w-full text-left px-3 py-2 text-sm">个人资料</button></li>
          <li><button id="settingsBtn" class="w-full text-left px-3 py-2 text-sm">设置</button></li>
          <li><button id="logoutBtn" class="w-full text-left px-3 py-2 text-sm">退出登录</button></li>
        </ul>`;
      dropdownContainer.appendChild(menu);
    }
    const avatar = dropdownContainer.querySelector('.user-avatar');
    if (avatar) {
      on(avatar, 'click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
      });
      // 外部点击关闭
      const onDocClick = (e) => {
        if (!dropdownContainer.contains(e.target)) {
          menu.classList.remove('show');
        }
      };
      document.addEventListener('click', onDocClick);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') menu.classList.remove('show');
      });
      // 菜单项占位动作
      const settingsBtn = document.getElementById('settingsBtn');
      if (settingsBtn) on(settingsBtn, 'click', () => {
        const navSettings = document.getElementById('navSettings');
        menu.classList.remove('show');
        navSettings?.click();
      });
    }
  }

  // ====== Add Category 模态：打开/关闭/保存 ======
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const addCategoryModal = document.getElementById('addCategoryModal');
  const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');
  const saveCategoryBtn = document.getElementById('saveCategoryBtn');
  const closeCategoryX = document.getElementById('closeCategoryX');
  const inpCategoryName = document.getElementById('inpCategoryName');
  const linksGroupList = document.getElementById('linksGroupList');

  if (addCategoryBtn && addCategoryModal) {
    // 中文注释：打开新增分类模态
    on(addCategoryBtn, 'click', () => openModal(addCategoryModal));
  }
  if (cancelCategoryBtn && addCategoryModal) {
    // 中文注释：取消关闭
    on(cancelCategoryBtn, 'click', () => closeModal(addCategoryModal));
  }
  if (closeCategoryX && addCategoryModal) {
    // 中文注释：右上角关闭
    on(closeCategoryX, 'click', () => closeModal(addCategoryModal));
  }
  if (saveCategoryBtn && addCategoryModal && inpCategoryName && linksGroupList) {
    // 中文注释：保存分类（持久化到 localStorage 并刷新侧栏与 Edit 下拉）
    on(saveCategoryBtn, 'click', () => {
      const name = inpCategoryName.value.trim();
      if (!name) { alert('请输入分类名称'); return; }
      ensureCategory(name);
      inpCategoryName.value = '';
      closeModal(addCategoryModal);
    });
  }
  // 中文注释：分类删除（事件委托 + 确认弹窗），不影响已存在卡片的 category
  if (linksGroupList) {
    delegate(linksGroupList, '.category-delete', 'click', (e, btn) => {
      const name = btn.previousElementSibling?.textContent?.trim();
      if (!name) return;
      openConfirm({
        title: '删除分类？',
        message: '此操作不会影响已存在卡片的分类。',
        onOk: () => {
          categories = categories.filter(c => c !== name);
          persistCategories();
          renderCategoriesSidebar();
          syncEditCategorySelect();
        }
      });
    });
  }
}

// ===== 动态加载用户数据（未来接 Supabase）=====
function loadUserWelcome() {
  const card = document.getElementById("userWelcomeCard");
  if (card) {
    card.innerHTML = `
      <div class="user-welcome-card">
        <h2 class="text-lg font-bold mb-1">晚上好，<span class="text-primary">SoloDev</span> 👋</h2>
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">今天是个充满灵感的夜晚。</p>
      </div>`;
  }

  const avatarContainer = document.getElementById("userDropdownContainer");
  if (avatarContainer) {
    avatarContainer.innerHTML = `
      <img src="https://i.pravatar.cc/100?u=solodev" alt="User Avatar"
        class="user-avatar" title="SoloDev" />`;
  }
}

// 确保在页面加载完成后执行
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}
