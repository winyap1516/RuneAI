
import { $, $$, fadeIn, slideToggle, on, openModal, closeModal, show, hide, mountHTML, delegate } from "../utils/dom.js";
// Use mock functions from project root directory, keep interface consistent
import { mockAIFromUrl as mockAIFromUrlExternal, mockFetchSiteContent as mockFetchSiteContentExternal } from "../../mockFunctions.js";

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

// Normalize URLs for comparison (ignore protocol and trailing slashes, compare host + path only)
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

// Check if a URL is subscribed (enabled !== false)
function isUrlSubscribed(url = '') {
  const subs = storageAdapter.loadSubscriptions();
  const n = normalizeForCompare(url || '');
  return subs.some(s => s && s.enabled !== false && normalizeForCompare(s.url || '') === n);
}

// Get Tailwind color classes based on tag keywords (light and dark mode compatible)
function getTagClass(tag = "") {
  const t = tag.toLowerCase();
  if (/(^|\b)(ai|research)(\b|$)/.test(t)) return "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300";
  if (/(^|\b)(design|ux)(\b|$)/.test(t)) return "bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-300";
  if (/(^|\b)(productivity)(\b|$)/.test(t)) return "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-300";
  if (/(^|\b)(development|dev)(\b|$)/.test(t)) return "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300";
  return "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300";
}

// Unified button loading state toggle (disable + text change), preserve styling
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

// Build card icon (prefer favicon, fallback to title initial)
function buildIconHTML({ title = "", url = "" } = {}) {
  const initial = (title || url || "U").trim().charAt(0).toUpperCase() || "U";
  // 简化：直接使用首字符方块；如需 favicon 可替换为 img 标签（保留注释说明）
  return `
    <div class="rune-card-icon w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center text-base font-bold">
      ${escapeHTML(initial)}
    </div>
  `;
}

// Unified card template, returns complete HTML string
export function createCard(data = {}) {
  // Contains id for event delegation card positioning; other fields for UI display
  const { id = "", title = "Untitled", description = "AI-generated summary placeholder…", category = "", tags = [], url = "" } = data;
  const tagsHtml = (Array.isArray(tags) ? tags : []).map((raw) => {
    const label = String(raw).trim();
    const colorCls = getTagClass(label);
    return `<span class="rune-tag ${colorCls}">${escapeHTML(label)}</span>`;
  }).join("");

  return `
    <div class="rune-card group rounded-xl border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-surface-dark p-3 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all" data-card-id="${escapeHTML(id)}" data-category="${escapeHTML(category)}">
      <div class="rune-card-head flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          ${buildIconHTML({ title, url })}
          <div class="rune-card-title text-base font-bold">${escapeHTML(title)}</div>
        </div>
        <button class="more-btn material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark" title="More">more_horiz</button>
        <!-- Card top-right more menu (Edit/Regenerate/Delete/Unsubscribe) -->
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
      <!-- Subscription button area (main button + controls container); controls only shown after subscription. Frequency settings moved to "Subscription Settings" page, no frequency controls here -->
      <div class="mt-3 card-actions flex items-center justify-end gap-2">
        ${(() => { const nurl = normalizeUrl(url); return `<button class\="btn-subscribe btn btn-small btn-muted\" data-url=\"${escapeHTML(nurl)}\">Subscribe</button>`; })()}
        <div class="card-controls" style="display:none;">
          <button class="btn-generate-once btn btn-small btn-outline" data-sub-id="">Generate Digest Now</button>
        </div>
      </div>
    </div>
  `;
}

// =============================
// 💾 本地存储与数据模型（localStorage）
// =============================

// Generate stable unique ID (timestamp + random segment)
function generateId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Storage key conventions
const STORAGE_KEYS = { cards: 'rune_cards', categories: 'rune_categories' };

// In-memory data structures
let cards = [];
const cardsMap = new Map();
let categories = [];
// Reserved category set (cannot be deleted); All Links used to display all cards
const RESERVED_CATEGORIES = new Set(['All Links']);

// Read/write localStorage (with fallback)
function loadFromStorage(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function saveToStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

// 中文注释：删除订阅并清理关联 Digest 条目（支持传入订阅 id 或 url）
function deleteSubscriptionAndCleanup(subIdOrUrl) {
  const subs = storageAdapter.loadSubscriptions();
  const digests = storageAdapter.loadDigests();
  const byIdOrUrl = (s) => String(s.id) === String(subIdOrUrl) || normalizeForCompare(s.url || '') === normalizeForCompare(subIdOrUrl || '');
  const leftSubs = subs.filter(s => !byIdOrUrl(s));
  storageAdapter.deleteSubscription(subIdOrUrl);
  const cleaned = digests.map(d => {
    if (!Array.isArray(d.entries)) return d;
    d.entries = d.entries.filter(e => {
      const matchId = String(e.subscriptionId) === String(subIdOrUrl);
      const matchUrl = normalizeForCompare(e.url || '') === normalizeForCompare(subIdOrUrl || '');
      return !(matchId || matchUrl);
    });
    d.siteCount = Array.isArray(d.entries) ? d.entries.length : 0;
    return d;
  }).filter(d => !Array.isArray(d.entries) || d.entries.length > 0);
  const keepIds = new Set(cleaned.map(x => x.id));
  digests.forEach(d => { if (!keepIds.has(d.id)) storageAdapter.deleteDigest(d.id); });
  cleaned.forEach(c => storageAdapter.saveDigest(c));
  markSubscribedButtons();
}

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
  if (RESERVED_CATEGORIES.has(n)) return; // 跳过保留分类
  if (!categories.includes(n)) {
    categories.push(n);
    persistCategories();
    renderCategoriesSidebar();
    syncEditCategorySelect();
  }
}

// Mark subscription button states on cards based on current subscription data
  function markSubscribedButtons() {
  // Normalize both subscription and button URLs to avoid matching failures due to slashes/case differences
  const subs = storageAdapter.loadSubscriptions();
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
    const subsAll = storageAdapter.loadSubscriptions();
    const sub = subsAll.find(s => s.enabled !== false && normalizeForCompare(s.url) === normalizeForCompare(url));
    const isOn = !!sub;
    if (controls) controls.style.display = isOn ? 'inline-flex' : 'none';
    if (onceBtn) { onceBtn.disabled = !isOn; onceBtn.dataset.subId = sub?.id || ''; }
    if (menuUnsub) { if (isOn) menuUnsub.classList.remove('hidden'); else menuUnsub.classList.add('hidden'); }
  });
  syncCardControlsVisibility();
}

// Sync card controls visibility after rendering (fallback for async insertion)
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

// URL normalization (complete protocol, clean spaces, unify domain case); returns empty string on failure
function normalizeUrl(raw = '') {
  const s = String(raw).trim();
  if (!s) return '';
  const guess = /^(https?:)?\/\//i.test(s) ? s : `https://${s}`; // 默认补全为 https
  try {
    const u = new URL(guess);
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return '';
  }
}

// Find existing card by URL to avoid duplicate additions
function findCardByUrl(url = '') {
  const target = String(url).trim();
  if (!target) return null;
  return cards.find(c => String(c.url).trim() === target) || null;
}

// =============================
// ☁️ 云端 AI 封装（Supabase Edge Functions）
// =============================

// Automatically determine if cloud mode is enabled (only when necessary environment variables exist)
const SUPABASE_URL = (import.meta?.env?.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta?.env?.VITE_SUPABASE_ANON_KEY || '').trim();
const useCloud = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// 中文注释：调用 Edge Function 生成 AI 摘要/分类；失败抛错（由调用方处理回退）
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
  // 期望返回字段：{ title, description, category, tags }
  return data;
}

// 中文注释：云端拉取已保存的 links（通过 Supabase PostgREST）；失败则返回空数组
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
    // 映射为前端卡片结构
    return (Array.isArray(arr) ? arr : []).map(row => ({
      id: row.id || generateId(),
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

// 中文注释：侧栏分类渲染（与删除按钮）
function renderCategoriesSidebar() {
  const list = document.getElementById('linksGroupList');
  if (!list) return;
  list.innerHTML = '';
  // 中文注释：首先插入“All Links”保留分类（无删除按钮），点击显示全部卡片
  const allItem = document.createElement('div');
  allItem.className = 'flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5';
  allItem.setAttribute('data-name', ''); // 空名称代表显示全部
  allItem.innerHTML = `
    <button class="category-filter text-sm font-medium text-left flex-1">All Links</button>
  `;
  list.appendChild(allItem);
  // 其他分类（可删除）
  categories.forEach(cat => {
    if (!cat || RESERVED_CATEGORIES.has(cat)) return;
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5';
    item.setAttribute('data-name', cat);
    item.innerHTML = `
      <button class="category-filter text-sm font-medium text-left flex-1">${escapeHTML(cat)}</button>
      <button class="category-delete text-xs text-text-secondary-light dark:text-text-secondary-dark">Delete</button>
    `;
    list.appendChild(item);
  });
}

// 中文注释：Edit 模态下拉同步当前分类（支持新增）
function syncEditCategorySelect() {
  const sel = document.getElementById('editLinkCategory');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select Category</option>' + categories.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('') + '<option value="__new__">+ New category…</option>';
}

// 中文注释：从 URL 模拟生成 AI 元数据（标题/摘要/类别/标签）
// 中文注释：移除本地 mock，实现统一从 mockFunctions.js 引入；保留 createCard 作为模板构建函数

export function initDashboard() {
  console.log("📊 Dashboard initialized");

  // 中文注释：开发模式下运行轻量级单元测试，覆盖 URL 规范化/标签颜色映射/去重逻辑
  if (import.meta?.env?.DEV) {
    try {
      const cases = [
        { in: 'example.com', out: 'https://example.com/' },
        { in: 'HTTP://EXAMPLE.COM/path', out: 'http://example.com/path' },
        { in: 'https://github.com', out: 'https://github.com/' },
      ];
      cases.forEach(({ in: raw, out }) => {
        const got = normalizeUrl(raw);
        if (!got || !got.startsWith(out.replace(/\/$/, ''))) throw new Error(`normalizeUrl 失败: ${raw} -> ${got}`);
      });
      if (!getTagClass('ai')) throw new Error('getTagClass 映射失败');
      console.log('✅ 自测通过：normalizeUrl / getTagClass');
    } catch (err) {
      console.warn('❌ 自测失败：', err);
    }
    // 中文注释：集成自测（仅当 URL 包含 selftest 标记时执行，不影响正常使用）
    if (window.location.search.includes('selftest')) {
      (async () => {
        try {
          const url = normalizeUrl('example.com/selftest');
          let ai = null;
          if (useCloud) { try { ai = await fetchAIFromCloud(url); } catch { ai = null; } }
          const mock = ai || await mockAIFromUrlExternal(url);
          const data = {
            id: generateId(),
            title: mock?.title || 'SelfTest',
            description: mock?.description || 'Integration test placeholder',
            category: mock?.category || 'All Links',
            tags: Array.isArray(mock?.tags) && mock.tags.length ? mock.tags : ['bookmark'],
            url,
          };
          addCardToStore(data);
          console.log('✅ Self-test: add flow completed');
          deleteCardFromStore(data.id);
          console.log('✅ Self-test: delete flow completed');
        } catch (e) {
          console.warn('❌ Self-test failed:', e);
        }
      })();
    }
  }

  // 缓存默认主内容 HTML，以便在视图切换后恢复
  const mainEl = document.querySelector('main');
  const defaultMainHTML = mainEl ? mainEl.innerHTML : '';

  // ====== Logo 按钮：返回首页 ======
  const logoBtn = document.getElementById("logoBtn");
  if (logoBtn) {
    // 中文注释：点击 Logo 进行“软刷新”（仅重置主视图与数据），避免浏览器因整页刷新产生 ERR_ABORTED 日志
    on(logoBtn, "click", () => {
      try { renderDefaultMain(); } catch {}
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
    { header: "subsGroupHeader", body: "subsGroupBody" },
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
      // 中文注释：恢复主视图后重新渲染卡片（从 localStorage 或云端拉取），避免空页面
      try { seedDemoCards(); } catch {}
      // 中文注释：重新标记订阅按钮状态（新容器）
      markSubscribedButtons();
    }
  }
  // 中文注释：通用文本输入模态（替代 prompt）
async function openTextPrompt({ title='Input', placeholder='' } = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById('textPromptModal');
      const input = document.getElementById('textPromptInput');
      const ttl = document.getElementById('textPromptTitle');
      const btnOk = document.getElementById('textPromptOk');
      const btnCancel = document.getElementById('textPromptCancel');
      if (!modal || !input || !ttl || !btnOk || !btnCancel) return resolve(null);
      ttl.textContent = title;
      input.value = '';
      input.placeholder = placeholder;
      modal.style.display = 'flex';
      function cleanup() {
        modal.style.display = 'none';
        btnOk.removeEventListener('click', onOk);
        btnCancel.removeEventListener('click', onCancel);
      }
      function onOk() { cleanup(); resolve(input.value); }
      function onCancel() { cleanup(); resolve(null); }
      btnOk.addEventListener('click', onOk);
      btnCancel.addEventListener('click', onCancel);
      setTimeout(() => input.focus(), 0);
    });
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
        <!-- 中文注释：使用网格布局 digest-grid -->
        <div id="digestList" class="digest-grid"></div>
      </section>
    `);
    // 中文注释：填充订阅下拉
    const subs = storageAdapter.loadSubscriptions();
    const sel = document.getElementById('digestSub');
    if (sel) {
      sel.innerHTML = '<option value="">All Subscriptions</option>' + subs.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.title||s.url)}</option>`).join('');
    }
    // 渲染列表
    const listEl = document.getElementById('digestList');
    const dateEl = document.getElementById('digestDate');
    const mockBtn = document.getElementById('digestMockGenerate');
    const retryBtn = document.getElementById('digestRetryErrors');
    const searchEl = document.getElementById('digestSearch');
    const render = () => {
      // 中文注释：仅渲染当日合并 Digest（merged=true），按日期过滤；未选日期则展示全部合并条目
      const all = storageAdapter.loadDigests();
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
        // 中文注释：计算显示用时间戳（优先 updated_at，其次 created_at）
        const ts = d.updated_at || d.created_at || Date.now();
        const tsText = new Date(ts).toLocaleString();
        const card = document.createElement('div');
        // 中文注释：网格卡片样式，增加 hover 浮起效果与圆角
        card.className = 'digest-card bg-surface-light dark:bg-surface-dark rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer relative group flex flex-col h-full';
        card.setAttribute('data-digest-id', d.id);
        
        // 中文注释：卡片内容 - 标题、日期、ID、SiteCount、站点简要列表
        // 站点简要列表：限制显示前 5 个，超出显示 +N more
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
               <!-- 中文注释：卡片上的快速删除按钮 -->
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
          <!-- 中文注释：卡片右下角补充信息：生成时间 + 查看摘要按钮 -->
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
      // 中文注释：生成当日合并 Digest（merged=true），只新增/更新一条当日卡片
      const subsAll = storageAdapter.loadSubscriptions().filter(s=>s.enabled!==false);
      const targetId = sel?.value || '';
      const targets = targetId ? subsAll.filter(s => s.id === targetId) : subsAll;
      if (!targets.length) {
        alert('No active subscriptions');
        return;
      }
      try {
        const dateStr = new Date().toISOString().slice(0,10);
        const digests = storageAdapter.loadDigests();
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
          digests.push(merged);
        }
        storageAdapter.saveDigest(merged);
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-primary text-white text-sm shadow-lg';
        toast.textContent = `Merged digest generated (${merged.siteCount} sites)`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1600);
        render();
      } catch (e) { alert('Generation failed'); }
    });
    // 下载事件委托（不再在卡片上直接操作，保留逻辑以防万一，但UI上按钮已移除或移动）
    // 中文注释：详情面板中的下载按钮逻辑需单独绑定
    
    // 删除事件委托（带确认弹窗）
    delegate(listEl, '.digest-delete', 'click', (e, btn) => {
      e.preventDefault();
      e.stopPropagation();
      // e.stopImmediatePropagation(); // 不需要，只要阻止冒泡即可
      const id = btn.getAttribute('data-id');
      if (!id) return;
      openConfirm({
        title: 'Delete digest?',
        message: 'This action cannot be undone.',
        onOk: () => {
          storageAdapter.deleteDigest(id);
          // 轻量提示
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
    
    // 点击 Digest 卡片显示详细内容（详情 Modal / Side Panel）
    delegate(listEl, '.digest-card', 'click', (e, card) => {
      // 避免点击内部按钮时触发
      if (e.target.closest('button')) return;
      
      const id = card.getAttribute('data-digest-id');
      const all = storageAdapter.loadDigests();
      const d = all.find(x => x.id === id);
      if (!d) return;
      
      let panel = document.getElementById('digestDetailPanel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'digestDetailPanel';
        panel.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
        // 中文注释：详情 Modal 结构
        panel.innerHTML = `
          <div class="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-surface-light dark:bg-surface-dark shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <!-- Header -->
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
            
            <!-- Body (Scrollable) -->
            <div id="digestDetailEntries" class="flex-1 overflow-y-auto p-6 flex flex-col gap-4"></div>
          </div>`;
        document.body.appendChild(panel);
      }
      
      // 填充数据
      const t = document.getElementById('digestDetailTitle');
      const m = document.getElementById('digestDetailMeta');
      const dlBtn = document.getElementById('digestDetailDownload');
      
      if (t) t.textContent = `${d.title}`;
      if (m) m.textContent = `${d.date} · ${Number(d.siteCount|| (Array.isArray(d.entries)?d.entries.length:0))} sites · ID: ${d.id}`;
      
      // 绑定下载事件
      if (dlBtn) {
        // 移除旧的监听器（通过替换节点）
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
        // 中文注释：不展示 Raw JSON
      }
      
      show(panel);
      
      const closeBtn = document.getElementById('digestDetailClose');
      if (closeBtn) {
          // 防止多次绑定
          const newClose = closeBtn.cloneNode(true);
          closeBtn.parentNode.replaceChild(newClose, closeBtn);
          newClose.onclick = () => hide(panel);
      }
      
      // 点击遮罩关闭
      panel.onclick = (ev) => {
          if (ev.target === panel) hide(panel);
      };
    });

    // 中文注释：“查看摘要”按钮显式打开详情面板
    delegate(listEl, '.digest-view-btn', 'click', (e, btn) => {
      e.preventDefault(); e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const all = storageAdapter.loadDigests();
      const d = all.find(x => x.id === id);
      if (!d) return;
      // 复用卡片点击逻辑：触发卡片点击以打开详情
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
          <!-- 中文注释：订阅设定分区（集中管理抓取频率） -->
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
    // 中文注释：打开设置面板后渲染“订阅设定”列表（若模块已加载）
    try { if (typeof window.renderSubscriptionsSettings === 'function') window.renderSubscriptionsSettings(); } catch {}
    const closeBtn = document.getElementById('settingsCloseBtn');
    if (closeBtn) on(closeBtn, 'click', () => { hide(panel); hide(backdrop); });
    on(backdrop, 'click', () => { hide(panel); hide(backdrop); });
  });

  // ====== 通用确认模态封装 ======
  // 中文注释：通用确认模态支持危险动作样式（okDanger=true 时红色按钮）
function openConfirm({ title = 'Confirm action?', message = 'This action cannot be undone.', onOk = () => {}, okDanger = false } = {}) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const btnCancel = document.getElementById('confirmCancel');
    const btnOk = document.getElementById('confirmOk');
    if (!modal || !titleEl || !msgEl || !btnCancel || !btnOk) return;
    titleEl.textContent = title;
    msgEl.textContent = message;
    show(modal);
    // 中文注释：设置模态状态，屏蔽头像点击动作
    document.body.dataset.modalOpen = '1';
    // 中文注释：根据危险动作切换按钮样式（红色强调）
    if (okDanger) { btnOk.classList.add('bg-red-600','text-white'); }
    else { btnOk.classList.remove('bg-red-600','text-white'); }
    const cleanup = () => {
      hide(modal);
       delete document.body.dataset.modalOpen;
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
        // 中文注释：使用独立类名，避免与头像下拉样式/逻辑冲突
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
        // 简单定位：跟随按钮在视窗右上区域
        const rect = notifyBtn.getBoundingClientRect();
        panel.style.position = 'fixed';
        panel.style.top = `${rect.bottom + 8}px`;
        panel.style.right = '16px';
        show(panel);
        const closeBtn = panel.querySelector('#notifCloseBtn');
        on(closeBtn, 'click', (ev) => { ev.preventDefault(); ev.stopPropagation(); hide(panel); });
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
        if (panel.style.display === 'none' || !panel.style.display) { show(panel); } else { hide(panel); }
      }
    });
  }

  // ====== 初始化用户卡片（避免重复注入） ======
  const card = document.getElementById("userWelcomeCard");
  if (card) {
    card.innerHTML = `
      <div class="user-welcome-card">
        <h2 class="text-lg font-bold mb-1">Good evening, <span class="text-primary">SoloDev</span> 👋</h2>
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">A night full of inspiration.</p>
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
    on(addLinkBtn, 'click', () => {
      if (inpUrl) inpUrl.value = ''; // 清空输入框，防止残留上次的输入
      openModal(addLinkModal);
    });
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
      // 中文注释：若输入为空或 normalizeUrl 失败（如纯空格），则提示无效
      const raw = (inpUrl.value || '').trim();
      if (!raw) { alert('Please enter a valid URL'); return; }
      const normalized = normalizeUrl(raw);
      if (!normalized) {
        alert('Please enter a valid URL');
        return;
      }
      // 中文注释：去重检查，若已存在则直接提示并阻止重复添加；后续可改为更新逻辑
      const exists = findCardByUrl(normalized);
      if (exists) {
        alert('This link already exists.');
        return;
      }
      setLoading(saveLinkBtn, true, 'Generating summary…');
      // 中文注释：优先尝试云端 AI；失败或未配置则回退到本地 mock
      let ai = null;
      if (useCloud) {
        try { ai = await fetchAIFromCloud(normalized); } catch { ai = null; }
      }
      const mock = ai || await mockAIFromUrlExternal(normalized).catch(() => ({ title: '', description: '', category: 'All Links', tags: ['bookmark'] }));
      const data = {
        id: generateId(),
        title: mock?.title || (normalized.replace(/^https?:\/\//, '').split('/')[0] || 'Untitled'),
        description: mock?.description || 'Mock: Auto-generated summary placeholder.',
        category: mock?.category || 'All Links',
        tags: Array.isArray(mock?.tags) && mock.tags.length ? mock.tags : ['bookmark'],
        url: normalized,
      };
      addCardToStore(data);
      const html = createCard(data);
      cardsContainer.insertAdjacentHTML('afterbegin', html);
      // 中文注释：刷新订阅按钮状态（与现有订阅匹配显示 Subscribed）
      markSubscribedButtons();
      inpUrl.value = '';
      closeModal(addLinkModal);
      setLoading(saveLinkBtn, false);
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

  // ===== 动态加载用户数据（未来接 Supabase）=====
  loadUserWelcome();

  // ====== 注入示例卡片，用于自测交互 ======
  function seedDemoCards() {
    const container = document.getElementById('cardsContainer');
    if (!container) return;
    // 中文注释：云端模式优先尝试拉取 links；否则回退本地缓存与示例注入
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
    if (useCloud) {
      // 尝试云端拉取；成功则渲染并缓存到本地，作为离线数据
      (async () => {
        const cloud = await loadCloudLinks();
      if (cloud.length > 0) {
        container.innerHTML = '';
        cloud.forEach(c => {
          const html = createCard(c);
          container.insertAdjacentHTML('beforeend', html);
          // 中文注释：按 URL 去重合并到本地缓存
          if (!findCardByUrl(c.url)) addCardToStore(c);
          ensureCategory(c.category);
        });
        renderCategoriesSidebar();
        syncEditCategorySelect();
        markSubscribedButtons();
        return;
      }
        // 若云端为空，继续示例注入
        injectSamples();
      })();
      return;
    }
    injectSamples();
    function injectSamples() {
      // 中文注释：统一使用 createCard(data) 渲染示例卡片，确保与新增链接的 UI 一致
      const samples = [
      {
        id: generateId(),
        title: 'Figma — Design tool',
        description: 'AI Summary: Figma is a modern design collaboration platform for prototyping and UI design.',
        category: 'Design',
        tags: ['Design', 'Productivity'],
        url: 'https://figma.com/',
      },
      {
        id: generateId(),
        title: 'OpenAI — GPT Models',
        description: 'AI Summary: OpenAI provides advanced large language models and API access.',
        category: 'AI',
        tags: ['AI', 'Research'],
        url: 'https://openai.com/',
      },
      {
        id: generateId(),
        title: 'GitHub — Code hosting',
        description: 'AI Summary: GitHub is a mainstream code hosting and collaboration platform.',
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
      markSubscribedButtons();
    }
  }
  seedDemoCards();
  // 中文注释：订阅按钮统一处理函数（放在外层作用域，供统一事件绑定调用）
  // 中文注释：行为说明：
  // 1）首次点击将卡片 URL 写入 localStorage 的 rune_subscriptions，结构包含 id/url/title/frequency/enabled/lastChecked
  // 2）再次点击进行 toggle：enabled = false 表示取消订阅；enabled = true 表示启用订阅
  // 3）更新按钮 UI 文案与高亮；同时刷新左侧 SUBSCRIPTIONS 列表并同步其他卡片按钮状态
  const handleSubscribe = (e, btn) => {
    e.preventDefault();
    e.stopPropagation();
    // 中文注释：立即阻止后续同源事件（避免 click 与 pointerdown 双重触发导致状态闪烁）
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    const url = normalizeUrl(btn.getAttribute('data-url') || '');
    if (!url) return;
    // 中文注释：按钮短暂 loading，提升交互反馈（不改变最终文案）
    setLoading(btn, true, 'Processing…');
    const subs = storageAdapter.loadSubscriptions();
    // 中文注释：查找是否已有该 URL 的订阅记录（不区分 enabled 状态）
    let existed = subs.find(s => normalizeUrl(s.url) === url);
    if (existed) {
      // 中文注释：仅在未启用时执行启用；已订阅状态下不支持直接取消订阅（改用三点菜单）
      const wasEnabled = existed.enabled !== false;
      if (!wasEnabled) {
        storageAdapter.saveSubscription({ ...existed, enabled: true });
      }
    } else {
      // 中文注释：创建新订阅记录（lastChecked 初始为 0）
      const card = btn.closest('.rune-card');
      const titleEl = card?.querySelector('.rune-card-title');
      const titleText = titleEl?.textContent?.trim() || url.replace(/^https?:\/\//, '').split('/')[0];
      const sub = { id: generateId(), url, title: titleText, frequency: 'daily', enabled: true, lastChecked: 0 };
      storageAdapter.saveSubscription(sub);
    }
    // 中文注释：关闭 loading，再根据最新状态更新按钮文案与样式
    setLoading(btn, false);
    const nowEnabled = (subs.find(s => normalizeUrl(s.url) === url)?.enabled !== false);
    applySubscribeStyle(btn, nowEnabled);
    // 中文注释：同步所有卡片上的按钮状态，无需侧栏刷新
    markSubscribedButtons();
  };
  // 中文注释：统一抽象事件绑定，避免散落在各处导致维护困难
  function registerCardEvents() {
    // 中文注释：避免重复绑定（通过全局标记控制）
    if (document.body.dataset.cardEventsBound === '1') return;
    document.body.dataset.cardEventsBound = '1';
    // 中文注释：Subscribe 按钮仅绑定 click，避免 pointerdown 与 click 叠加触发造成闪烁
    delegate(document, '.btn-subscribe', 'click', handleSubscribe);
    // 中文注释：频率设置（打开下拉选择 Modal）
    const freqModal = document.getElementById('freqModal');
    const freqSelect = document.getElementById('freqSelect');
    const freqOk = document.getElementById('freqOk');
    const freqCancel = document.getElementById('freqCancel');
    let __freqEditingSubId = null;
    function openFreqModal(subId) {
      __freqEditingSubId = subId;
      const subs = storageAdapter.loadSubscriptions();
      const sub = subs.find(s => s.id === subId) || {};
      if (freqSelect) freqSelect.value = sub.frequency || 'daily';
      freqModal?.classList.remove('hidden');
    }
    function closeFreqModal() { __freqEditingSubId = null; freqModal?.classList.add('hidden'); }
    if (freqCancel) freqCancel.addEventListener('click', () => closeFreqModal());
    if (freqOk) freqOk.addEventListener('click', () => {
      if (!__freqEditingSubId) { closeFreqModal(); return; }
      const val = freqSelect?.value || 'daily';
      const subs = storageAdapter.loadSubscriptions();
      const idx = subs.findIndex(s => s.id === __freqEditingSubId);
      if (idx !== -1) {
        storageAdapter.saveSubscription({ ...subs[idx], frequency: val, lastChecked: subs[idx].lastChecked || 0 });
      }
      markSubscribedButtons();
      closeFreqModal();
    });

    // 中文注释：“生成一次”（单站点写入当日合并 Digest）
    delegate(document, '.btn-generate-once', 'click', async (e, b) => {
      e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      const subId = b.getAttribute('data-sub-id') || '';
      const subs = storageAdapter.loadSubscriptions().filter(s=>s.enabled!==false);
      const target = subs.find(s => s.id === subId);
      if (!target) return;
      try {
        const site = await mockFetchSiteContentExternal(target.url);
        const ai = await mockAIFromUrlExternal(target.url);
        const eobj = { subscriptionId: target.id, url: normalizeUrl(target.url), title: ai.title || target.title || target.url, summary: ai.description || (site?.content||'').slice(0,500) || 'No summary', highlights: Array.isArray(ai.tags)?ai.tags:[], raw: { site, ai } };
        const dateStr = new Date().toISOString().slice(0,10);
        const digests = storageAdapter.loadDigests();
        let merged = digests.find(d => d.date === dateStr && d.merged === true);
        if (merged) {
          const exist = new Set((merged.entries||[]).map(x=>normalizeUrl(x.url)));
          if (!exist.has(eobj.url)) (merged.entries||[]).push(eobj);
          merged.entries = merged.entries || [];
          merged.siteCount = merged.entries.length; merged.updated_at = Date.now();
        } else {
          merged = { id: `digest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`, date: dateStr, merged: true, title: `AI Digest · ${dateStr}`, siteCount: 1, entries: [eobj], created_at: Date.now() };
          digests.push(merged);
        }
        storageAdapter.saveDigest(merged);
        const t = document.createElement('div'); t.className='fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-primary text-white text-sm shadow-lg'; t.textContent=`Merged digest generated (${merged.siteCount} sites)`; document.body.appendChild(t); setTimeout(()=>t.remove(),1600);
      } catch { alert('Generation failed'); }
    });
  }

  // =============================
  // 🧰 卡片更多菜单 + 编辑/删除 事件委托
  // =============================
  if (cardsContainer) {
    // 中文注释：为卡片容器添加一次性 MutationObserver，检测到子节点变更后同步按钮状态（兜底）
    if (!document.body.dataset.subsObserverBound) {
      const obs = new MutationObserver(() => { try { markSubscribedButtons(); } catch {} });
      obs.observe(cardsContainer, { childList: true, subtree: false });
      document.body.dataset.subsObserverBound = '1';
    }
    // 中文注释：注册统一事件绑定
    registerCardEvents();
    // 中文注释：取消旧容器委托，避免与文档级委托重复触发导致状态回滚
    // 中文注释：关闭所有卡片菜单（防多开）
    const closeAllMenus = () => {
      const menus = cardsContainer.querySelectorAll('.rune-card-menu');
      menus.forEach(m => m.classList.add('hidden'));
    };

    // 中文注释：文档级“更多”按钮委托，避免容器重建失效
    const closeAllMenusDoc = () => {
      const menus = document.querySelectorAll('.rune-card-menu');
      menus.forEach(m => m.classList.add('hidden'));
    };
    delegate(document, '.more-btn', 'click', (e, btn) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      // 中文注释：打开卡片菜单前关闭头像下拉，并设置全局菜单开启标记
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

    // 中文注释：编辑操作 → 文档级委托，打开 Edit 模态并预填
    delegate(document, '.menu-edit', 'click', (e, btn) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      // 中文注释：打开编辑前关闭头像下拉，避免同时出现多个浮层
      closeUserDropdown();
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
        if (!url) { alert('URL cannot be empty'); return; }
        // 更新内存与持久化
        const tags = tagsStr ? tagsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        updateCardInStore(id, { title, url, description, tags, category });
        ensureCategory(category);
        // 中文注释：云端模式下同步更新（乐观更新，失败仅提示不回滚）
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
              const warn = document.createElement('div');
              warn.className = 'text-orange-600 text-sm mt-2';
              warn.textContent = 'Cloud update failed (saved locally)';
              document.body.appendChild(warn);
              setTimeout(() => { warn.remove(); }, 2000);
            }
          })();
        }
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
        ok.textContent = 'Saved';
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

    // 中文注释：删除操作 → 文档级委托，确认后删除 DOM 与内存
    delegate(document, '.menu-delete', 'click', (e, btn) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeUserDropdown();
      const cardEl = btn.closest('.rune-card');
      const id = cardEl?.getAttribute('data-card-id');
      if (!id) return;
      const data = cardsMap.get(id);
      const menu = cardEl.querySelector('.rune-card-menu');
      openConfirm({
        title: `Delete saved link "${escapeHTML(data?.title || (data?.url||'').replace(/^https?:\/\//,''))}"?`,
        message: 'This will remove the link and its related digest entries.',
        onOk: () => {
          // 淡出动画后移除
          cardEl.style.transition = 'opacity 160ms ease';
          cardEl.style.opacity = '0';
          setTimeout(() => { cardEl.remove(); }, 180);
          deleteCardFromStore(id);
          if (data?.url) {
            deleteSubscriptionAndCleanup(data.url);
          }

          // 中文注释：云端模式下按 URL 删除（若存在 URL）
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
                const warn = document.createElement('div');
                warn.className = 'text-orange-600 text-sm mt-2';
                warn.textContent = 'Cloud delete failed (deleted locally)';
                document.body.appendChild(warn);
                setTimeout(() => { warn.remove(); }, 2000);
              }
            })();
          }
          if (menu) menu.classList.add('hidden');
        }
      });
    });

    // 中文注释：取消订阅 → 文档级委托，确认后退订并清理关联 Digest
    delegate(document, '.menu-unsubscribe', 'click', (e, btn) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeUserDropdown();
      const cardEl = btn.closest('.rune-card');
      const id = cardEl?.getAttribute('data-card-id');
      if (!id) return;
      const data = cardsMap.get(id);
      const titleText = data?.title || (data?.url||'').replace(/^https?:\/\//,'');
      const subUrl = data?.url || '';
      openConfirm({
        title: `Unsubscribe from "${escapeHTML(titleText)}"?`,
        message: 'You will no longer receive AI digests for this site.',
        okDanger: true,
        onOk: () => {
          if (subUrl) {
            const subs = storageAdapter.loadSubscriptions();
            const idx = subs.findIndex(s => normalizeForCompare(s.url||'') === normalizeForCompare(subUrl));
            if (idx !== -1) {
              storageAdapter.saveSubscription({ ...subs[idx], enabled: false });
            }
          }
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
        // 中文注释：若模态弹窗开启则不响应头像点击
        if (document.body.dataset.modalOpen === '1' || document.body.dataset.menuOpen === '1') return;
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
      if (!name) { alert('Please enter a category name'); return; }
      ensureCategory(name);
      inpCategoryName.value = '';
      closeModal(addCategoryModal);
    });
  }
  // 中文注释：分类删除（事件委托 + 确认弹窗），不影响已存在卡片的 category
  if (linksGroupList) {
    // 中文注释：点击分类名称进行筛选显示同类卡片
    delegate(linksGroupList, '.category-filter', 'click', (e, btn) => {
      const name = btn?.closest('div')?.getAttribute('data-name') || '';
      // 中文注释：若主视图当前为 Digest/Chat（无卡片容器），先恢复默认主内容
      let container = document.getElementById('cardsContainer');
      if (!container) {
        renderDefaultMain();
        container = document.getElementById('cardsContainer');
      }
      const cardsEls = container ? Array.from(container.children) : [];
      let visibleCount = 0;
      cardsEls.forEach((el) => {
        const match = !name || el.getAttribute('data-category') === name; // name 为空表示“全部”
        el.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });
      // 同步空状态占位
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
    delegate(linksGroupList, '.category-delete', 'click', (e, btn) => {
      const name = btn?.closest('div')?.getAttribute('data-name') || '';
      if (!name || RESERVED_CATEGORIES.has(name)) return; // 保留分类不可删除
      openConfirm({
        title: 'Delete category?',
        message: 'This will not affect existing card categories.',
        onOk: () => {
          categories = categories.filter(c => c !== name);
          persistCategories();
          renderCategoriesSidebar();
          syncEditCategorySelect();
        }
      });
    });
  }

  // 中文注释：已移除侧栏订阅交互（用户通过卡片按钮进行订阅管理）

  // ====== 手动生成 Digest ======
  async function generateDigestNow(subId) {
    const subs = storageAdapter.loadSubscriptions();
    const sub = subs.find(s => s.id === subId);
    if (!sub) return;
    await processSubscription(sub);
    // 中文注释：Digest 生成完成后，仅同步按钮状态即可
    markSubscribedButtons();
  }
}

// ===== 动态加载用户数据（未来接 Supabase）=====
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

// 确保在页面加载完成后执行
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}
// 中文注释：关闭头像下拉的辅助函数（避免与卡片菜单/模态冲突）
function closeUserDropdown() {
  try {
    const ctn = document.getElementById('userDropdownContainer');
    const dd = ctn?.querySelector('.user-dropdown');
    dd?.classList.remove('show');
  } catch {}
}
  // 中文注释：侧栏订阅列表已移除；保留按钮状态同步方法 markSubscribedButtons
// 中文注释：统一应用订阅按钮样式（已订阅/未订阅）
function applySubscribeStyle(btn, subscribed) {
  if (!btn) return;
  btn.classList.remove('btn-primary','btn-muted','btn-outline','bg-primary','text-white','bg-gray-100');
  btn.classList.add('btn','btn-small');
  if (subscribed) { btn.classList.add('btn-primary'); btn.innerHTML = 'Subscribed'; }
  else { btn.classList.add('btn-muted'); btn.innerHTML = 'Subscribe'; }
}
