import { USER_ID, DIGEST_TYPE, LIMITS, COOLDOWN } from "../config/constants.js";
import { escapeHTML } from "../utils/ui-helpers.js";

let _containerEl = null; // This view renders into mainEl directly or a specific container? 
// dashboard.js renderDigestView replaced mainEl content.
// So initDigestView might take mainEl, or a container inside it.
// dashboard.js passed `mainEl` to mountHTML.
// I'll assume initDigestView takes { containerEl } where containerEl is mainEl.

let _controllers = null;
let _templates = null;
let _utils = null;

export function initDigestView({ containerEl, controllers, templates, utils }) {
  _containerEl = containerEl;
  _controllers = controllers;
  _templates = templates;
  _utils = utils;
  console.log("📚 DigestView initialized");
}

export async function renderDigests(list = null) {
    if (!_containerEl) return;
    
    // 1. Mount Base Layout
    const { mountHTML, on } = _utils.dom;
    mountHTML(_containerEl, `
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

    // 2. Fetch Data
    let rawDigests = list;
    if (!rawDigests) {
        const res = await _controllers.digestController.fetchPage(0, 20);
        rawDigests = res.items;
    }
    
    const links = await _controllers.linkController.getLinks();
    const subs = await _controllers.linkController.getSubscriptions();

    // 3. Populate Filters
    const sel = document.getElementById('digestSub');
    if (sel) {
      sel.innerHTML = '<option value="">All Subscriptions</option>' + subs.map(s => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.title||s.url)}</option>`).join('');
    }

    // 4. Render List (using merge logic from controller)
    const all = _controllers.digestController.mergeDigestEntries(rawDigests, links);
    updateDigestList(all);
    
    // 5. Initialize Limit UI
    updateDigestLimitUI();
    
    // 6. Bind Events (Local to this view render)
    bindDigestEvents();
}

function updateDigestList(mergedDigests) {
    const listEl = document.getElementById('digestList');
    const dateEl = document.getElementById('digestDate');
    const sel = document.getElementById('digestSub');
    const searchEl = document.getElementById('digestSearch');
    
    if (!listEl) return;
    
    const date = dateEl?.value || '';
    const siteId = sel?.value || '';
    const keyword = (searchEl?.value || '').trim().toLowerCase();
    
    const filtered = mergedDigests.filter(d => (!date || d.date === date)).filter(d => {
        if (!siteId && !keyword) return true;
        const entries = Array.isArray(d.entries) ? d.entries : [];
        const bySite = !siteId || entries.some(e => String(e.subscriptionId) === String(siteId));
        const byText = !keyword || entries.some(e => (e.title||'').toLowerCase().includes(keyword) || (e.summary||'').toLowerCase().includes(keyword));
        return bySite && byText;
    });
    
    listEl.innerHTML = filtered.length ? '' : '<div class="col-span-full text-sm text-text-secondary-light dark:text-text-secondary-dark">No digests yet</div>';
    
    filtered.forEach(d => {
        listEl.insertAdjacentHTML('beforeend', _templates.createDigestCard(d));
    });
}

export function bindDigestEvents() {
    const { on, delegate, openInfoModal, openTextPrompt, openConfirm, show, hide } = _utils.dom;
    const { digestController, linkController } = _controllers;

    const dateEl = document.getElementById('digestDate');
    const sel = document.getElementById('digestSub');
    const searchEl = document.getElementById('digestSearch');
    const mockBtn = document.getElementById('digestMockGenerate');
    
    const refresh = async () => {
        const { items } = await digestController.fetchPage(0, 20);
        const links = await linkController.getLinks();
        const all = digestController.mergeDigestEntries(items, links);
        updateDigestList(all);
    };
    
    if (dateEl) on(dateEl, 'change', refresh);
    if (sel) on(sel, 'change', refresh);
    if (searchEl) on(searchEl, 'input', refresh);
    
    // Generate Daily Digest
    if (mockBtn) on(mockBtn, 'click', async () => {
        const userId = _utils.storageAdapter?.getUser()?.id || USER_ID.GUEST;
        const isDev = userId === USER_ID.DEFAULT;
        const limit = isDev ? LIMITS.DEV_LIMIT : LIMITS.DAILY_GENERATE;
        
        const usage = digestController.getDailyUsageCount(userId, DIGEST_TYPE.DAILY);
        if (usage >= limit) {
            openInfoModal({ title: 'Limit Reached', message: `Daily limit of ${limit} reached.` });
            return;
        }
        
        const lastTime = digestController.getLastGenerationTime(null, DIGEST_TYPE.DAILY);
        if (Date.now() - lastTime < COOLDOWN.DURATION_MS) {
            const wait = Math.ceil((COOLDOWN.DURATION_MS - (Date.now() - lastTime))/1000);
            openInfoModal({ title: 'Cooldown', message: `Please wait ${wait}s.` });
            return;
        }
        
        setLoading(mockBtn, true, 'Generating…');
        mockBtn.dataset.loading = '1';
        
        try {
            const targetId = sel?.value || null;
            const { successCount, failedCount, errors } = await digestController.generateDailyDigest(targetId);
            
            if (successCount === 0 && failedCount === 0) {
                 openInfoModal({ title: 'No Subscriptions', message: 'No active subscriptions found.' });
                 return;
            }
            if (successCount === 0 && failedCount > 0) {
                 throw new Error(errors[0]?.error || 'Failed to generate.');
            }
            
            showToast(`Generated ${successCount} digests!`, 'success');
            refresh();
            updateDigestLimitUI();
            
        } catch (err) {
            openTextPrompt({ title: 'Generation Failed', placeholder: err.message });
        } finally {
            delete mockBtn.dataset.loading;
            setLoading(mockBtn, false);
            updateDigestLimitUI();
        }
    });

    // Delete Digest
    const listEl = document.getElementById('digestList');
    delegate(listEl, '.digest-delete', 'click', (e, btn) => {
        e.preventDefault(); e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (!id) return;
        
        openConfirm({
            title: 'Delete digest?',
            message: 'Cannot be undone.',
            okText: 'Delete',
            onOk: async () => {
                await digestController.deleteDigest(id);
                showToast('Deleted 1 digest', 'success');
                refresh();
            }
        });
    });
    
    // View Digest Detail
    delegate(listEl, '.digest-card', 'click', async (e, card) => {
        if (e.target.closest('button')) return;
        const id = card.getAttribute('data-digest-id');
        const all = await digestController.getDigestList();
        const d = all.find(x => x.id === id);
        if (!d) return;
        
        // Open Detail Modal (reusing logic from dashboard.js but simplified)
        // We need to fetch 'entries' which might be inside 'd' if it's a daily digest merged view.
        // Wait, getDigestList returns raw digests. 
        // We need the merged view to show the "Daily Digest" properly with multiple entries.
        // So we should use the merged list for finding the object.
        const links = await linkController.getLinks();
        const merged = digestController.mergeDigestEntries(all, links);
        const target = merged.find(x => x.id === id); // merged ID is like 'daily_...'
        
        if (target) showDigestDetail(target);
    });
}

export function clearList() {
    const listEl = document.getElementById('digestList');
    if (listEl) listEl.innerHTML = '';
}

export async function appendPage(items) {
    const listEl = document.getElementById('digestList');
    if (!listEl) return;
    if (!Array.isArray(items) || items.length === 0) return;

    // If empty message exists, remove it
    if (listEl.children.length === 1 && listEl.innerText.includes('No digests yet')) {
        listEl.innerHTML = '';
    }

    // We need links to merge properly
    const links = await _controllers.linkController.getLinks();
    const merged = _controllers.digestController.mergeDigestEntries(items, links);

    // Batch rendering
    const BATCH_SIZE = 5;
    let idx = 0;

    function renderBatch() {
        const batch = merged.slice(idx, idx + BATCH_SIZE);
        if (batch.length === 0) return;

        const html = batch.map(d => _templates.createDigestCard(d)).join('');
        listEl.insertAdjacentHTML('beforeend', html);
        
        idx += BATCH_SIZE;
        if (idx < merged.length) {
            requestAnimationFrame(renderBatch);
        }
    }
    renderBatch();
}

let _scrollListener = null;
let _scrollContainer = null;

export function enableInfiniteScroll(container, { onLoadMore, threshold = 200 }) {
    if (!container) return;
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
     console.warn('onScrollEnd is deprecated. Use enableInfiniteScroll instead.');
}

function showDigestDetail(d) {
    const { show, hide } = _utils.dom;
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
               <button id="digestDetailClose" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"><span class="material-symbols-outlined">close</span></button>
            </div>
            <div id="digestDetailEntries" class="flex-1 overflow-y-auto p-6 flex flex-col gap-4"></div>
          </div>`;
        document.body.appendChild(panel);
    }
    
    document.getElementById('digestDetailTitle').textContent = d.title;
    document.getElementById('digestDetailMeta').textContent = `${d.date} · ${d.entries.length} sites`;
    
    const container = document.getElementById('digestDetailEntries');
    container.innerHTML = '';
    d.entries.forEach(e => {
        const block = document.createElement('div');
        block.className = 'rounded-xl p-5 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800';
        block.innerHTML = `
          <div class="font-bold text-base mb-2">${escapeHTML(e.title)}</div>
          <div class="text-sm text-text-secondary-light leading-relaxed">${escapeHTML(e.summary)}</div>
        `;
        container.appendChild(block);
    });
    
    show(panel);
    const closeBtn = document.getElementById('digestDetailClose');
    closeBtn.onclick = () => hide(panel);
    panel.onclick = (ev) => { if(ev.target===panel) hide(panel); };
}

function updateDigestLimitUI() {
    const { digestController } = _controllers;
    const userId = _utils.storageAdapter?.getUser()?.id || USER_ID.GUEST;
    const btn = document.getElementById('digestMockGenerate');
    if (!btn) return;
    
    // Reusing checkAndApplyCooldown logic logic locally or import?
    // I'll just implement simple check here.
    const isDev = userId === USER_ID.DEFAULT;
    const limit = isDev ? LIMITS.DEV_LIMIT : LIMITS.DAILY_GENERATE;
    const count = digestController.getDailyUsageCount(userId, DIGEST_TYPE.DAILY);
    
    if (count >= limit) {
        btn.disabled = true;
        btn.textContent = 'Limit Reached';
        return;
    }
    
    const lastTime = digestController.getLastGenerationTime(null, DIGEST_TYPE.DAILY);
    if (Date.now() - lastTime < COOLDOWN.DURATION_MS) {
        btn.disabled = true;
        btn.textContent = 'Cooldown...';
    } else {
        btn.disabled = false;
        btn.textContent = "Generate Today's Digest";
    }
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
