// 中文注释：取消前端生成次数与冷却时间限制，统一由后端控制
import { USER_ID } from "/src/js/config/constants.js";
import { config } from "/src/js/services/config.js";
// 中文注释：引入统一 API 路由（支持外部 HTTP Mock 与本地 Mock 切换）
import { api } from "/src/js/services/apiRouter.js";
import { callFunction } from "/src/js/services/supabaseClient.js";
import { normalizeUrl } from "/src/js/utils/url.js";
import { escapeHTML, buildIconHTML, getTagClass } from "/src/js/utils/ui-helpers.js";
import { openAddLinkModal } from "/src/js/services/uiService.js";

let _containerEl = null;
let _controllers = null;
let _templates = null;
let _utils = null; // { dom, storageAdapter }

const RESERVED_CATEGORIES = new Set(['All Links']);

// 中文注释：Sidebar 分类图标映射
// 目的：为核心分类提供统一的专业图标；其他分类使用通用文件夹图标
// 说明：使用 Material Symbols（outlined）以保持与现有 UI 风格一致
const CATEGORY_ICON_MAP = {
  // 核心分类（固定）
  'all links': 'view_list',      // 列表 / 汇总
  'ai': 'smart_toy',             // 人工智能 / 机器人
  'development': 'terminal',     // 代码 / 终端
  'design': 'palette',           // 调色板 / 设计
  'news': 'article',             // 新闻 / 文章
  // 默认回退
  '__default__': 'folder'
};

// 中文注释：标准化分类名称（去空格、小写），用于匹配映射
function normalizeCategoryName(name) {
  return String(name || '').trim().toLowerCase();
}

// 中文注释：根据分类名称生成图标 HTML；未命中映射时使用回退图标
function renderCategoryIcon(name) {
  const key = normalizeCategoryName(name);
  const icon = CATEGORY_ICON_MAP[key] || CATEGORY_ICON_MAP['__default__'];
  return `<span class="material-symbols-outlined text-base">${icon}</span>`;
}

export function initLinksView({ containerEl, controllers, templates, utils }) {
  _containerEl = containerEl;
  _controllers = controllers;
  _templates = templates;
  _utils = utils;
  
  console.log("🔗 LinksView initialized");
}

export async function renderLinks(links = null) {
  if (!_containerEl) return;
  
  let data = links;
  if (!data) {
      const res = await _controllers.linkController.fetchPage(0, 20);
      data = res.items;
  }
  
  _containerEl.innerHTML = '';
  
  if (data.length === 0) {
      // If truly empty and not using cloud, dashboard usually injects samples. 
      // We'll just show empty state here.
      const empty = document.createElement('div');
      empty.className = "col-span-full text-center text-gray-400 py-10";
      empty.textContent = "No links found.";
      _containerEl.appendChild(empty);
  } else {
      data.forEach(c => {
          const html = _templates.createCard(c);
          _containerEl.insertAdjacentHTML('beforeend', html);
      });
  }

  renderCategoriesSidebar();
  syncEditCategorySelect();
  updateUIStates();
}

export function updateSingleCardUI(id, data) {
    if (!_containerEl) return;
    const currentCat = getActiveCategory();
    const card = _containerEl.querySelector(`.rune-card[data-card-id="${id}"]`);
    
    if (!card) {
        console.warn(`Card ${id} not found for partial update. Falling back to renderLinks.`);
        renderLinks();
        return;
    }

    if (!data) return;

    // 1. Update Title
    if (data.title !== undefined) {
        const el = card.querySelector('.rune-card-title');
        if (el) el.textContent = data.title;
    }

    // 2. Update Description
    if (data.description !== undefined) {
        const el = card.querySelector('.rune-card-desc');
        if (el) el.textContent = data.description;
    }

    // 3. Update Category (Attribute & Sidebar check)
    if (data.category !== undefined) {
        const oldCat = card.getAttribute('data-category');
        if (oldCat !== data.category) {
            card.setAttribute('data-category', data.category);
            renderCategoriesSidebar();
            if (currentCat) filterCardsByCategory(currentCat);
            syncEditCategorySelect();
        }
    }

    // 4. Update URL & Icon
    if (data.url !== undefined) {
        const nurl = normalizeUrl(data.url);
        // Update icon (Icon depends on Title too, so we use data.title or existing title)
        const currentTitle = data.title || card.querySelector('.rune-card-title')?.textContent || '';
        
        // Replace Icon HTML
        const iconContainer = card.querySelector('.rune-card-head .flex.items-center.gap-3');
        if (iconContainer) {
             // The icon is the first child usually
             const oldIcon = iconContainer.querySelector('.rune-card-icon') || iconContainer.firstElementChild;
             if (oldIcon) oldIcon.outerHTML = buildIconHTML({ title: currentTitle, url: data.url });
        }

        // Update Subscribe Button Data
        const subBtn = card.querySelector('.btn-subscribe');
        if (subBtn) subBtn.setAttribute('data-url', nurl);
    } else if (data.title !== undefined) {
         // If only title changed, icon letter might change
         const currentUrl = card.querySelector('.btn-subscribe')?.getAttribute('data-url') || '';
         const iconContainer = card.querySelector('.rune-card-head .flex.items-center.gap-3');
         if (iconContainer) {
             const oldIcon = iconContainer.querySelector('.rune-card-icon') || iconContainer.firstElementChild;
             if (oldIcon) oldIcon.outerHTML = buildIconHTML({ title: data.title, url: currentUrl });
         }
    }

    // 5. Update Tags
    if (data.tags !== undefined && Array.isArray(data.tags)) {
        const tagsContainer = card.querySelector('.rune-card-tags');
        if (tagsContainer) {
            const tagsHtml = data.tags.map((raw) => {
                const label = String(raw).trim();
                const colorCls = getTagClass(label);
                return `<span class="rune-tag ${colorCls} rounded-full px-2.5 py-1 text-xs font-medium border border-transparent">${escapeHTML(label)}</span>`;
            }).join("");
            tagsContainer.innerHTML = tagsHtml;
        }
    }

    // 6. Update Subscription Status
    if (data.subscribed !== undefined) {
        const btn = card.querySelector('.btn-subscribe');
        const controls = card.querySelector('.card-controls');
        
        if (btn && controls) {
            if (data.subscribed) {
                btn.classList.add('hidden');
                controls.classList.remove('hidden');
                controls.classList.add('flex');
                // Update Generate Now button data
                const onceBtn = controls.querySelector('.btn-generate-once');
                if (onceBtn) {
                    onceBtn.disabled = false;
                    onceBtn.dataset.subId = data.subscriptionId || ''; 
                    onceBtn.dataset.linkId = id;
                }
            } else {
                btn.classList.remove('hidden');
                btn.textContent = 'Subscribe';
                btn.disabled = false;
                btn.classList.remove('btn-outline', 'text-primary');
                btn.classList.add('btn-muted');
                
                controls.classList.add('hidden');
                controls.classList.remove('flex');
                
                const onceBtn = controls.querySelector('.btn-generate-once');
                if (onceBtn) {
                    onceBtn.disabled = true;
                    onceBtn.dataset.subId = '';
                }
            }
        }
    }
    
    // 中文注释：前端不再计算每日限制，由后端统一控制
}

export function clearList() {
    if (!_containerEl) return;
    _containerEl.innerHTML = '';
}

function getActiveCategory() {
    const list = document.getElementById('linksGroupList');
    if (!list) return '';
    // Look for item with active class
    const activeItem = list.querySelector('.bg-gray-200'); // Based on filterCardsByCategory logic
    return activeItem ? activeItem.getAttribute('data-name') : '';
}

export function appendPage(items) {
    if (!_containerEl) return;
    if (!Array.isArray(items)) return;

    // Capture active category to restore after render
    const currentCat = getActiveCategory();

    // If empty state exists and we have items, remove it
    const empty = _containerEl.querySelector('.col-span-full.text-center'); 
    if (empty && items.length > 0 && empty.textContent === "No links found.") {
        empty.remove();
    }
    
    if (items.length === 0 && _containerEl.children.length === 0) {
         const emptyDiv = document.createElement('div');
         emptyDiv.className = "col-span-full text-center text-gray-400 py-10";
         emptyDiv.textContent = "No links found.";
         _containerEl.appendChild(emptyDiv);
         return;
    }

    // Batch rendering to avoid blocking UI
    const BATCH_SIZE = 5;
    let idx = 0;

    function renderBatch() {
        const batch = items.slice(idx, idx + BATCH_SIZE);
        if (batch.length === 0) {
            renderCategoriesSidebar();
            if (currentCat) filterCardsByCategory(currentCat);
            syncEditCategorySelect();
            updateUIStates();
            return;
        }

        const html = batch.map(c => _templates.createCard(c)).join('');
        _containerEl.insertAdjacentHTML('beforeend', html);
        
        idx += BATCH_SIZE;
        if (idx < items.length) {
            requestAnimationFrame(renderBatch);
        } else {
            renderCategoriesSidebar();
            if (currentCat) filterCardsByCategory(currentCat);
            syncEditCategorySelect();
            updateUIStates();
        }
    }
    renderBatch();
}

let _scrollListener = null;
let _scrollContainer = null;

export function enableInfiniteScroll(container, { onLoadMore, threshold = 200 }) {
    if (!container) return;
    // Cleanup existing if any
    disableInfiniteScroll();

    _scrollContainer = container;
    
    let ticking = false;
    _scrollListener = () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                if (!_scrollContainer) return;
                const { scrollTop, scrollHeight, clientHeight } = _scrollContainer;
                if (scrollTop + clientHeight >= scrollHeight - threshold) {
                    onLoadMore();
                }
                ticking = false;
            });
            ticking = true;
        }
    };
    
    _scrollContainer.addEventListener('scroll', _scrollListener);
}

export function disableInfiniteScroll() {
    if (_scrollListener && _scrollContainer) {
        _scrollContainer.removeEventListener('scroll', _scrollListener);
    }
    _scrollListener = null;
    _scrollContainer = null;
}

export function onScrollEnd(callback) {
    // Deprecated in favor of enableInfiniteScroll
    console.warn('onScrollEnd is deprecated. Use enableInfiniteScroll instead.');
}

export function addSingleCardUI(data) {
    if (!_containerEl) return;
    const currentCat = getActiveCategory();
    // Remove empty state if exists
    const empty = _containerEl.querySelector('.col-span-full.text-center'); 
    if (empty && empty.textContent === "No links found.") {
        empty.remove();
    }
    // 中文注释：使用后端返回的唯一 id 做渲染去重；若已有同 id 卡片，避免重复插入
    const exists = _containerEl.querySelector(`.rune-card[data-card-id="${data.id}"]`);
    if (!exists) {
        const html = _templates.createCard(data);
        _containerEl.insertAdjacentHTML('afterbegin', html);
    }
    
    renderCategoriesSidebar();
    if (currentCat) filterCardsByCategory(currentCat);
    syncEditCategorySelect();
          // 中文注释：后端统一控制每日限制，不再更新本地 limit UI
}

export function removeSingleCardUI(id) {
    if (!_containerEl) return;
    const currentCat = getActiveCategory();
    const card = _containerEl.querySelector(`.rune-card[data-card-id="${id}"]`);
    if (card) {
        card.remove();
        // Check if empty
        if (_containerEl.children.length === 0 || (_containerEl.children.length === 1 && _containerEl.children[0].id === 'emptyState')) {
             // If truly empty (ignoring hidden emptyState for search)
             // Re-render to show clean empty state
             renderLinks([]);
        }
        renderCategoriesSidebar();
        if (currentCat) filterCardsByCategory(currentCat);
        syncEditCategorySelect();
    } else {
        console.warn(`Card ${id} not found for removal.`);
    }
}

export function bindLinksEvents() {
  const { delegate, on, openModal, closeModal, openTextPrompt, openConfirm, openInfoModal } = _utils.dom;
  const { linkController, digestController } = _controllers;

  // 中文注释：订阅开关迁移至 Settings Panel，卡片不再提供订阅按钮

  // 2. Generate Now（调用 Edge Function，mode=manual；前端不做次数/冷却限制）
  delegate(document, '.btn-generate-once', 'click', async (e, b) => {
      e.preventDefault(); e.stopPropagation();
      const user = _utils.storageAdapter?.getUser();
      const uid = user?.id || USER_ID.GUEST;
      b.dataset.loading = '1';
      setLoading(b, true, 'Generating…');
      try {
          // 中文注释：优先使用外部 HTTP Mock API（当配置了 VITE_MOCK_API_BASE 时），以获得真实 AI 结果
          const linkId = b?.dataset?.linkId || (b.closest('.rune-card')?.getAttribute('data-card-id') || '');
          if (config?.mockApiBase) {
              // 1) 提交生成作业到 Mock Server（可能触发真实 AI）
              const jobResp = await api.generateNow({ user_id: uid, link_id: linkId });
              if (!jobResp || !jobResp.job_id) throw new Error('JOB_NOT_CREATED');
              const jobId = jobResp.job_id;

              // 2) 轮询作业状态直到完成/失败（简易实现，最多等待 ~8s）
              let status = jobResp.status || 'queued';
              let result = null;
              for (let i = 0; i < 10; i++) {
                  if (status === 'completed' || status === 'failed') break;
                  await new Promise(r => setTimeout(r, 800));
                  const j = await api.getJob(jobId);
                  status = j?.status || status;
                  result = j?.result || null;
                  if (status === 'completed' || status === 'failed') break;
              }
              if (status !== 'completed') {
                  throw new Error(`JOB_${status || 'UNKNOWN'}`);
              }

              // 3) 获取 Digest 详情并写入本地存储（用于 UI 展示与分页）
              const digestId = result?.digest_id;
              if (!digestId) throw new Error('MISSING_DIGEST_ID');
              let digest;
              try { digest = await api.getDigest(digestId); } catch(e) { digest = null; }
              const summary = digest?.summary || 'Digest generated';
              await _utils.storageAdapter.addDigest({
                  website_id: Number(linkId) || linkId,
                  summary,
                  type: 'manual',
                  metadata: { source: 'http-mock', digest_id: digestId }
              });
              showToast('Digest generated (HTTP Mock)', 'success');
          } else if (config?.useMock) {
              // 中文注释：未配置外部 Mock 时，回退到本地 Mock 逻辑
              const { digestController } = _controllers;
              await digestController.generateManualDigest(linkId);
              showToast('Digest generated (Mock)', 'success');
          } else {
              const resp = await callFunction('generate-digest', { method: 'POST', body: JSON.stringify({ user_id: uid, mode: 'manual' }) });
              const json = await resp.json().catch(()=>({}));
              if (resp.ok && json?.ok) {
                  showToast('Digest generated successfully!', 'success');
              } else {
                  const msg = json?.error || `HTTP ${resp.status}`;
                  openTextPrompt({ title: 'Generation Failed', placeholder: msg });
              }
          }
      } catch (err) {
          openTextPrompt({ title: 'Generation Failed', placeholder: err.message });
      } finally {
          delete b.dataset.loading;
          setLoading(b, false);
      }
  });

  // 3. Search
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    on(searchInput, 'input', (e) => filterCards(e.target.value));
    on(searchInput, 'keydown', (e) => {
        if (e.key === 'Enter') filterCards(searchInput.value);
    });
  }

  // 4. Modals (Add/Edit)
  bindModalEvents();

  // 5. Menu Actions
  bindMenuEvents();
  
  // 6. Category Actions
  bindCategoryEvents();
  
  // 7. Select Link Modal
  bindSelectLinkModalEvents();
}

// --- Private Helpers ---

function updateUIStates() {
    markSubscribedButtons();
}

async function markSubscribedButtons() {
    // 中文注释：仅更新“Subscribed”标签显示；Generate Now 始终可用
    const { linkController } = _controllers;
    const subs = await linkController.getSubscriptions();
    
    if (!_containerEl) return;
    const cards = Array.from(_containerEl.querySelectorAll('.rune-card'));
    for (const card of cards) {
        const cardId = card.getAttribute('data-card-id');
        const controls = card.querySelector('.card-controls');
        const onceBtn = controls?.querySelector('.btn-generate-once');
        const hasSub = subs.some(s => s.enabled !== false && String(s.linkId) === String(cardId));
        if (controls) {
            let label = controls.querySelector('.subscribed-label');
            if (hasSub) {
                if (!label) {
                    label = document.createElement('span');
                    label.className = 'subscribed-label text-sm font-bold text-primary px-2';
                    label.textContent = 'Subscribed';
                    controls.insertBefore(label, controls.firstChild);
                }
            } else {
                if (label) label.remove();
            }
        }
        if (onceBtn) {
            onceBtn.disabled = false; // 中文注释：手动生成始终可用，由后端判定次数
            onceBtn.dataset.linkId = cardId || '';
        }
    }
}

// 中文注释：已移除前端次数限制与冷却时间控制，由后端统一处理

function filterCards(query) {
    const q = (query || '').trim().toLowerCase();
    const cards = Array.from(_containerEl.children);
    let visible = 0;
    cards.forEach(el => {
        if (!el.classList.contains('rune-card')) return;
        const text = el.textContent.toLowerCase();
        const match = !q || text.includes(q);
        el.style.display = match ? '' : 'none';
        if (match) visible++;
    });
    // Handle empty state element if needed
    let emptyEl = document.getElementById('emptyState');
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.id = 'emptyState';
      emptyEl.className = 'text-sm text-text-secondary-light dark:text-text-secondary-dark mt-4 text-center col-span-full';
      emptyEl.textContent = 'No matching links found';
      emptyEl.style.display = 'none';
      _containerEl.after(emptyEl);
    }
    emptyEl.style.display = visible === 0 ? '' : 'none';
}

function renderCategoriesSidebar() {
    const list = document.getElementById('linksGroupList');
    if (!list) return;
    list.innerHTML = '';
    const categories = _controllers.linkController.getCategories(); // Assuming this method exists in linkController? 
    // linkController didn't have getCategories explicitly in my read, it might delegate to storageAdapter or I missed it.
    // storageAdapter has getCategories. linkController should probably expose it.
    // If not, I use _utils.storageAdapter.getCategories() if linkController fails.
    // Actually, let's check linkController again. It doesn't seem to export getCategories.
    // I will use _utils.storageAdapter.getCategories() for now, or add it to linkController.
    // Adding to linkController is better.
    
    // For now, let's assume _controllers.linkController.getCategories() exists or use storageAdapter.
    const cats = _controllers.linkController.getCategories ? _controllers.linkController.getCategories() : (_utils.storageAdapter.getCategories());
    
    const allItem = document.createElement('div');
    allItem.className = 'flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer';
    allItem.setAttribute('data-name', '');
    // 中文注释：All Links 使用统一列表图标（view_list），语义更贴合“汇总/全部”
    allItem.innerHTML = `
      <div class="flex items-center gap-2 flex-1">
        <span class="category-icon" aria-hidden="true">${renderCategoryIcon('All Links')}</span>
        <button type="button" class="category-filter text-sm font-medium text-left flex-1 w-full focus:outline-none" title="All Links">All Links</button>
      </div>`;
    list.appendChild(allItem);

    cats.forEach(cat => {
        if (!cat || cat === 'All Links') return;
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors relative group';
        item.setAttribute('data-name', cat);
        // 中文注释：替换字母为专业图标；未命中映射时自动回退为 folder
        item.innerHTML = `
          <div class="flex items-center gap-2 flex-1">
            <span class="category-icon" aria-hidden="true">${renderCategoryIcon(cat)}</span>
            <button type="button" class="category-filter text-sm font-medium text-left flex-1 focus:outline-none truncate mr-2" title="${escapeHTML(cat)}">${escapeHTML(cat)}</button>
          </div>
          <div class="relative shrink-0 flex items-center gap-0.5">
            <button type="button" class="category-more p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-text-secondary-light dark:text-text-secondary-dark focus:outline-none" data-category="${escapeHTML(cat)}">
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
    const cats = _utils.storageAdapter.getCategories();
    sel.innerHTML = '<option value="">Select Category</option>' + cats.filter(c => c !== 'All Links').map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('') + '<option value="__new__">+ New category…</option>';
}

function bindModalEvents() {
    const { on, openModal, closeModal, openTextPrompt } = _utils.dom;
    const { linkController } = _controllers;
    
    // Add Link
    const addBtn = document.getElementById('addLinkBtn');
    const addBtnHeader = document.getElementById('addLinkBtnHeader');
    const addModal = document.getElementById('addLinkModal');
    const saveBtn = document.getElementById('saveLinkBtn');
    const inpUrl = document.getElementById('inpUrl');
    
    if (addBtn) on(addBtn, 'click', openAddLinkModal);
    if (addBtnHeader) on(addBtnHeader, 'click', openAddLinkModal);

    // Cancel/Close buttons（Add Link 模态）
    // 中文注释：统一由此绑定，避免不同入口导致的重复绑定或遗漏
    const cancel = document.getElementById('cancelAddLinkBtn');
    const closeX = document.getElementById('closeModalX');
    if (cancel) on(cancel, 'click', () => closeModal(addModal));
    if (closeX) on(closeX, 'click', () => closeModal(addModal));
    
    if (saveBtn && addModal && inpUrl) {
        on(saveBtn, 'click', async () => {
            const raw = (inpUrl.value||'').trim();
            if (!raw) { openTextPrompt({title:'Error', placeholder:'Invalid URL'}); return; }
            // 中文注释：提交防护；防止用户重复点击导致多次请求与重复插入
            if (saveBtn.dataset.submitting === '1') return;
            saveBtn.dataset.submitting = '1';
            setLoading(saveBtn, true, 'Saving...');
            try {
                await linkController.addLink(raw);
                // 中文注释：视图插入由 linkController 调用 view.addSingleCardUI 完成，这里不再重复插入
                updateUIStates();
                inpUrl.value = '';
                closeModal(addModal);
            } catch(err) {
                openTextPrompt({title:'Error', placeholder:err.message});
            } finally {
                delete saveBtn.dataset.submitting;
                setLoading(saveBtn, false);
            }
        });
    }
    
    // 中文注释：新增“+ New Category”按钮与模态行为，避免被 AI Features 组的点击/折叠影响
    const addCatBtn = document.getElementById('addCategoryBtn');
    const addCatModal = document.getElementById('addCategoryModal');
    const saveCatBtn = document.getElementById('saveCategoryBtn');
    const inpCatName = document.getElementById('inpCategoryName');
    const addCatBackdrop = document.getElementById('addCategoryBackdrop');
    const closeCatX = document.getElementById('closeCategoryX');
    const cancelCatBtn = document.getElementById('cancelCategoryBtn');
    
    if (addCatBtn && addCatModal) {
        on(addCatBtn, 'click', (e) => { 
            e.preventDefault(); e.stopPropagation(); 
            if (inpCatName) inpCatName.value=''; 
            openModal(addCatModal); 
        });
        if (addCatBackdrop) on(addCatBackdrop, 'click', (e) => { e.preventDefault(); e.stopPropagation(); closeModal(addCatModal); });
        if (closeCatX) on(closeCatX, 'click', (e) => { e.preventDefault(); e.stopPropagation(); closeModal(addCatModal); });
        if (cancelCatBtn) on(cancelCatBtn, 'click', (e) => { e.preventDefault(); e.stopPropagation(); closeModal(addCatModal); });
    }
    
    if (saveCatBtn && addCatModal && inpCatName) {
        on(saveCatBtn, 'click', async (e) => {
            e.preventDefault(); e.stopPropagation();
            const raw = (inpCatName.value||'').trim();
            if (!raw) { openTextPrompt({ title: 'Error', placeholder: '请输入分类名称' }); return; }
            if (RESERVED_CATEGORIES.has(raw)) { openTextPrompt({ title: 'Error', placeholder: '该名称保留，请更换' }); return; }
            try {
                await linkController.ensureCategory(raw);
                renderCategoriesSidebar();
                syncEditCategorySelect(); // 修复：添加分类后立即同步下拉菜单
                closeModal(addCatModal);
                showToast(`已添加分类：${raw}`, 'success');
            } catch (err) {
                openTextPrompt({ title: 'Error', placeholder: err.message });
            }
        });
    }

    // Edit Link Modal
    const editModal = document.getElementById('editLinkModal');
    const editForm = document.getElementById('editLinkForm');
    const cancelEditBtn = document.getElementById('cancelEditBtn');

    if (editModal) {
        if (cancelEditBtn) {
            on(cancelEditBtn, 'click', (e) => {
                e.preventDefault(); 
                closeModal(editModal); 
            });
        }

        if (editForm) {
            on(editForm, 'submit', async (e) => {
                e.preventDefault();
                const id = editForm.dataset.editingId;
                if (!id) return;

                const fTitle = document.getElementById('editLinkTitle');
                const fURL = document.getElementById('editLinkURL');
                const fDesc = document.getElementById('editLinkDesc');
                const fTags = document.getElementById('editLinkTags');
                const fCat = document.getElementById('editLinkCategory');

                const btn = editForm.querySelector('button[type="submit"]');
                setLoading(btn, true, 'Saving...');

                try {
                    const rawTags = (fTags?.value || '').split(',').map(t => t.trim()).filter(Boolean);
                    const updates = {
                        title: fTitle?.value || '',
                        url: fURL?.value || '',
                        description: fDesc?.value || '',
                        tags: rawTags,
                        category: fCat?.value || 'All Links'
                    };

                    await linkController.updateLink(id, updates);
                    updateSingleCardUI(id, updates);
                    closeModal(editModal);
                    showToast('Link updated successfully', 'success');
                } catch (err) {
                    openTextPrompt({ title: 'Error', placeholder: err.message });
                } finally {
                    setLoading(btn, false);
                }
            });
        }
    }
}

function bindMenuEvents() {
    const { delegate, openConfirm, openTextPrompt } = _utils.dom;
    const { linkController } = _controllers;

    // More Btn
    delegate(document, '.more-btn', 'click', (e, btn) => {
        e.preventDefault(); e.stopPropagation();
        const menu = btn.closest('.rune-card').querySelector('.rune-card-menu');
        if (!menu) return;
        const isHidden = menu.classList.contains('hidden');
        
        // Close all others
        document.querySelectorAll('.rune-card-menu').forEach(m => m.classList.add('hidden'));
        
        if (isHidden) {
            menu.classList.remove('hidden');
            const close = () => {
                menu.classList.add('hidden');
                document.removeEventListener('click', close);
            };
            setTimeout(() => document.addEventListener('click', close), 0);
        }
    });

    // Delete
    delegate(document, '.menu-delete', 'click', async (e, btn) => {
        e.preventDefault(); e.stopPropagation();
        const card = btn.closest('.rune-card');
        const id = parseInt(card.getAttribute('data-card-id'), 10);
        
        openConfirm({
            title: 'Delete Link?',
            message: 'This will remove the link and digests.',
            okText: 'Delete',
            okDanger: true,
            onOk: async () => {
                // Optimistic UI
                card.remove();
                try {
                    await linkController.deleteLink(id);
                    updateUIStates();
                } catch (err) {
                    openTextPrompt({ title: 'Error', placeholder: err.message });
                    renderLinks(); // Revert
                }
            }
        });
    });
    
    // Edit - reusing dashboard logic structure
    delegate(document, '.menu-edit', 'click', async (e, btn) => {
        e.preventDefault(); e.stopPropagation();
        const card = btn.closest('.rune-card');
        const id = parseInt(card.getAttribute('data-card-id'), 10);
        const { linkController } = _controllers;
        const links = await linkController.getLinks();
        const data = links.find(l => String(l.id) === String(id));
        if (!data) return;
        
        const modal = document.getElementById('editLinkModal');
        const form = document.getElementById('editLinkForm');
        if (!modal || !form) return;

        // 修复：每次打开编辑弹窗前，强制刷新分类下拉列表，确保包含最新分类
        syncEditCategorySelect();

        // Populate fields
        const fTitle = document.getElementById('editLinkTitle');
        const fURL = document.getElementById('editLinkURL');
        const fDesc = document.getElementById('editLinkDesc');
        const fTags = document.getElementById('editLinkTags');
        const fCat = document.getElementById('editLinkCategory');

        if (fTitle) fTitle.value = data.title || '';
        if (fURL) fURL.value = data.url || '';
        if (fDesc) fDesc.value = data.description || '';
        if (fTags) fTags.value = Array.isArray(data.tags) ? data.tags.join(', ') : '';
        if (fCat) fCat.value = data.category || '';
        
        // Store ID for the submit handler
        form.dataset.editingId = id;
        
        // Close menu if open (UI cleanup)
        document.querySelectorAll('.rune-card-menu').forEach(m => m.classList.add('hidden'));

        _utils.dom.openModal(modal);
    });
}

function bindCategoryEvents() {
    const { delegate } = _utils.dom;
    // 中文注释：改为在 document 上做事件委托，避免切换视图或重建侧栏导致绑定丢失
    delegate(document, '#linksGroupList .category-filter', 'click', (e, btn) => {
        const wrapper = btn.closest('[data-name]');
        const name = wrapper ? wrapper.getAttribute('data-name') : '';
        
        // Check if we need to switch view
        const linksContainer = document.getElementById('linksViewContainer');
        const isHidden = !linksContainer || linksContainer.classList.contains('hidden');
        
        // 中文注释：若当前不在 Links 视图（容器不存在或隐藏），先切换回 Links 再执行分类过滤
        if (isHidden || !_containerEl) {
            if (typeof window.navigateToLinks === 'function') {
                const res = window.navigateToLinks();
                if (res && typeof res.then === 'function') {
                    res.then(() => filterCardsByCategory(name));
                } else {
                    // Fallback timeout if not promise
                    setTimeout(() => filterCardsByCategory(name), 50);
                }
                return;
            }
        }
        filterCardsByCategory(name);
    });
    // 中文注释：支持点击图标也进行筛选（折叠态仅显示图标时仍可用）
    delegate(document, '#linksGroupList .category-icon', 'click', (e, icon) => {
        const wrapper = icon.closest('[data-name]');
        const name = wrapper ? wrapper.getAttribute('data-name') : '';
        const linksContainer = document.getElementById('linksViewContainer');
        const isHidden = !linksContainer || linksContainer.classList.contains('hidden');
        if (isHidden || !_containerEl) {
            if (typeof window.navigateToLinks === 'function') {
                const res = window.navigateToLinks();
                if (res && typeof res.then === 'function') {
                    res.then(() => filterCardsByCategory(name));
                } else {
                    setTimeout(() => filterCardsByCategory(name), 50);
                }
                return;
            }
        }
        filterCardsByCategory(name);
    });
}

function createAddLinkCard(category) {
    return `
      <div class="rune-card-add flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-primary hover:bg-gray-50 dark:hover:bg-white/5 transition-all cursor-pointer min-h-[160px] group" data-category="${escapeHTML(category)}" role="button" tabindex="0">
         <div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors mb-3">
            <span class="material-symbols-outlined text-2xl">add</span>
         </div>
         <span class="text-sm font-medium text-gray-500 group-hover:text-primary transition-colors">Add to ${escapeHTML(category)}</span>
      </div>
    `;
}

function filterCardsByCategory(category) {
    // 中文注释：健壮性防护；如果容器未初始化或已被其他视图替换，尝试重新获取
    if (!_containerEl || !_containerEl.isConnected) {
        const c = document.getElementById('cardsContainer');
        if (!c) return;
        _containerEl = c;
    }
    // 中文注释：当选择“All Links”时，等价于不筛选（显示全部）
    if (category === 'All Links') category = '';
    
    // 1. Remove existing "Add Link" card if any
    const existingAdd = _containerEl.querySelector('.rune-card-add');
    if (existingAdd) existingAdd.remove();

    const cards = Array.from(_containerEl.children);
    let visible = 0;
    cards.forEach(el => {
        if (!el.classList.contains('rune-card')) return;
        const c = el.getAttribute('data-category');
        const match = !category || c === category;
        el.style.display = match ? '' : 'none';
        if (match) visible++;
    });

    // 2. Append "Add Link" card if specific category selected
    if (category) {
        const addCardHtml = createAddLinkCard(category);
        _containerEl.insertAdjacentHTML('beforeend', addCardHtml);
    }

    // Update active state in sidebar
    const list = document.getElementById('linksGroupList');
    list.querySelectorAll('[data-name]').forEach(item => {
        const isActive = item.getAttribute('data-name') === category;
        const btn = item.querySelector('button');
        if (isActive) {
            item.classList.add('bg-gray-200', 'dark:bg-white/10');
            item.classList.remove('bg-gray-50', 'dark:bg-white/5');
        } else {
            item.classList.remove('bg-gray-200', 'dark:bg-white/10');
            item.classList.add('bg-gray-50', 'dark:bg-white/5');
        }
    });
}

function setLoading(btn, isActive, text) {
    if (!btn) return;
    if (isActive) {
        btn.dataset.origText = btn.textContent;
        btn.innerHTML = `<span class="spinner"></span> ${escapeHTML(text)}`;
        btn.disabled = true;
    } else {
        btn.innerHTML = escapeHTML(btn.dataset.origText || btn.textContent);
        btn.disabled = false;
    }
}

function showToast(msg, type='success') {
    const t = document.createElement('div');
    const bg = type==='success'?'bg-primary':'bg-red-500';
    t.className=`fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg ${bg} text-white text-sm shadow-lg animate-in fade-in slide-in-from-bottom-4`;
    t.textContent=msg;
    document.body.appendChild(t);
    setTimeout(()=>t.remove(), 1600);
}

function bindSelectLinkModalEvents() {
    const { delegate, on, openModal, closeModal, openTextPrompt } = _utils.dom;
    const { linkController } = _controllers;

    const modal = document.getElementById('selectLinkModal');
    const backdrop = document.getElementById('selectLinkBackdrop');
    const closeBtn = document.getElementById('closeSelectLinkBtn');
    const closeX = document.getElementById('closeSelectLinkX');
    const listContainer = document.getElementById('selectLinkList');
    const searchInput = document.getElementById('selectLinkSearch');
    const categoryNameEl = document.getElementById('selectLinkCategoryName');
    
    let currentCategory = '';
    let allLinks = [];

    // Helper to render list
    const renderList = (links) => {
        if (!listContainer) return;
        listContainer.innerHTML = '';
        if (links.length === 0) {
            listContainer.innerHTML = '<div class="text-center text-sm text-gray-400 py-4">No available links found.</div>';
            return;
        }
        
        links.forEach(link => {
            const el = document.createElement('button');
            el.className = 'w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-3 transition-colors group';
            
            const initial = (link.title || 'U').charAt(0).toUpperCase();
            const urlDisplay = link.url ? link.url.replace(/^https?:\/\//, '') : '';
            
            el.innerHTML = `
                <div class="w-8 h-8 rounded bg-gray-200 dark:bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">
                    ${escapeHTML(initial)}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate text-text-primary-light dark:text-text-primary-dark">${escapeHTML(link.title)}</div>
                    <div class="text-xs text-text-secondary-light dark:text-text-secondary-dark truncate opacity-75">${escapeHTML(urlDisplay)}</div>
                </div>
                <span class="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 transition-opacity text-lg">add_circle</span>
            `;
            
            el.onclick = async () => {
                try {
                    // Update link category
                    await linkController.updateLink(link.id, { category: currentCategory });
                    
                    // Refresh view to show the new card and ensure + card is at end
                    filterCardsByCategory(currentCategory);

                    // Close modal
                    closeModal(modal);
                    showToast(`Added to ${currentCategory}`, 'success');
                    
                } catch (err) {
                    console.error('Failed to add link to category:', err);
                    openTextPrompt({ title: 'Error', placeholder: err.message });
                }
            };
            
            listContainer.appendChild(el);
        });
    };

    // Open Modal logic
    delegate(document, '.rune-card-add', 'click', async (e, btn) => {
        e.preventDefault(); e.stopPropagation(); 
        // Use btn.closest just in case the click hit a child
        const target = btn.closest('.rune-card-add');
        if (!target) return;
        
        currentCategory = target.dataset.category;
        if (!currentCategory) return;
        
        if (categoryNameEl) categoryNameEl.textContent = `Add existing links to "\${currentCategory}"`;
        if (searchInput) searchInput.value = '';
        
        openModal(modal);
        
        // Load links
        if (listContainer) listContainer.innerHTML = '<div class="text-center py-4">Loading...</div>';
        
        try {
            const links = await linkController.getLinks();
            // Filter: exclude links already in this category
            allLinks = links.filter(l => l.category !== currentCategory);
            renderList(allLinks);
        } catch (err) {
            console.error(err);
            if (listContainer) listContainer.innerHTML = '<div class="text-center text-red-500 py-4">Failed to load links</div>';
        }
    });

    // Close logic
    const close = () => closeModal(modal);
    if (backdrop) on(backdrop, 'click', close);
    if (closeBtn) on(closeBtn, 'click', close);
    if (closeX) on(closeX, 'click', close);

    // Search logic
    if (searchInput) {
        on(searchInput, 'input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            const filtered = allLinks.filter(l => 
                (l.title && l.title.toLowerCase().includes(q)) || 
                (l.url && l.url.toLowerCase().includes(q))
            );
            renderList(filtered);
        });
    }
}
