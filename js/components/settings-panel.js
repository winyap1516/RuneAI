// 中文注释：订阅设定页面交互脚本（集中管理抓取频率）
// 中文注释：该模块提供 window.renderSubscriptionsSettings()，在设置面板打开后渲染订阅列表

import storageAdapter from '../storage/storageAdapter.js';
import { openConfirm } from '../utils/dom.js';
import { normalizeUrl } from '../utils/url.js';

// 中文注释：频率选项映射（与 js/main.js 保持一致）
const FREQ_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'every_1m', label: 'Every 1 minute (dev)' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'every_6h', label: 'Every 6 hours' },
  { value: 'daily', label: 'Daily' },
];

// 中文注释：监听存储变更，自动刷新 Settings 列表
storageAdapter.subscribe((event) => {
  if (event.type === 'subscriptions_changed' || event.type === 'links_changed') {
    // 只有当 Settings 面板可见时才刷新，避免不必要的 DOM 操作
    const wrap = document.getElementById('subsSettingsList');
    if (wrap && wrap.offsetParent !== null) {
      window.renderSubscriptionsSettings();
    }
  }
});

// 中文注释：渲染订阅设定列表（名称/URL/频率下拉），变更即保存
window.renderSubscriptionsSettings = function renderSubscriptionsSettings() {
  const wrap = document.getElementById('subsSettingsList');
  if (!wrap) return;

  // 1. 获取所有启用（enabled !== false）的订阅
  const allSubs = storageAdapter.getSubscriptions().filter(s => s.enabled !== false);
  
  // 2. 获取所有卡片链接，用于识别孤儿订阅
  const links = storageAdapter.getLinks();
  const linkedUrls = new Set(links.map(l => normalizeUrl(l.url)));

  // 3. 分类：正常订阅 vs 孤儿订阅
  const linkedSubs = [];
  const orphanSubs = [];

  allSubs.forEach(sub => {
    if (linkedUrls.has(normalizeUrl(sub.url))) {
      linkedSubs.push(sub);
    } else {
      orphanSubs.push(sub);
    }
  });
  
  wrap.innerHTML = '';
  
  // ============================
  // Render Active Subscriptions
  // ============================
  if (linkedSubs.length > 0) {
    const header = document.createElement('div');
    header.className = 'mb-4 pb-2 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between';
    header.innerHTML = `<div class="text-sm font-semibold text-gray-800 dark:text-gray-200">Active Subscriptions (${linkedSubs.length})</div>`;
    wrap.appendChild(header);

    const list = document.createElement('div');
    list.className = 'flex flex-col gap-3 mb-8';
    linkedSubs.forEach(sub => renderRow(sub, list, false));
    wrap.appendChild(list);
  } else if (orphanSubs.length === 0) {
    // No subscriptions at all
    const empty = document.createElement('div');
    empty.className = 'text-center py-8 text-sm text-text-secondary-light dark:text-text-secondary-dark';
    empty.textContent = 'No active subscriptions';
    wrap.appendChild(empty);
    return;
  }

  // ============================
  // Render Orphan Subscriptions
  // ============================
  if (orphanSubs.length > 0) {
    const header = document.createElement('div');
    header.className = 'mb-4 pb-2 border-b border-red-100 dark:border-red-900/30 flex items-center justify-between mt-6';
    header.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="text-sm font-semibold text-red-600 dark:text-red-400">Orphaned Subscriptions (${orphanSubs.length})</div>
        <div class="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">No matching card</div>
      </div>
    `;
    wrap.appendChild(header);

    const list = document.createElement('div');
    list.className = 'flex flex-col gap-3';
    orphanSubs.forEach(sub => renderRow(sub, list, true));
    wrap.appendChild(list);
  }
};

// 中文注释：渲染单行订阅项
function renderRow(sub, container, isOrphan) {
    const row = document.createElement('div');
    row.className = `flex items-center justify-between p-3 rounded-xl border transition-colors ${
        isOrphan 
        ? 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 hover:border-red-200 dark:hover:border-red-800' 
        : 'bg-gray-50 dark:bg-white/5 border-transparent hover:border-gray-200 dark:hover:border-gray-600'
    }`;
    
    const info = document.createElement('div');
    info.className = 'flex-1 min-w-0 mr-4';
    const title = escapeHTML(sub.title || sub.url || 'Untitled');
    const url = escapeHTML(sub.url || '');
    info.innerHTML = `
      <div class="text-sm font-bold truncate text-text-primary-light dark:text-text-primary-dark" title="${title}">${title}</div>
      <div class="text-xs text-text-secondary-light dark:text-text-secondary-dark truncate" title="${url}">${url}</div>
      ${isOrphan ? '<div class="text-[10px] text-red-500 mt-0.5">Card deleted or missing</div>' : ''}
    `;
    
    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-3 shrink-0';
    
    // Frequency Select (Only for non-orphans, or maybe both? Let's keep it for both)
    const sel = document.createElement('select');
    sel.className = 'px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-primary/50';
    FREQ_OPTIONS.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value; 
      o.textContent = opt.label; 
      sel.appendChild(o);
    });
    sel.value = String(sub.frequency || 'daily');
    sel.addEventListener('change', () => {
      const next = sel.value || 'daily';
      const arr = storageAdapter.getSubscriptions();
      const idx = arr.findIndex(s => String(s.id) === String(sub.id));
      if (idx !== -1) {
        storageAdapter.updateSubscription({ ...arr[idx], frequency: next });
        // Toast
        try {
            showToast('Frequency updated');
        } catch {}
      }
    });

    // Unsubscribe Button
    const unsubBtn = document.createElement('button');
    unsubBtn.className = 'px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors';
    unsubBtn.textContent = 'Unsubscribe';
    unsubBtn.onclick = () => {
        openConfirm({
            title: isOrphan ? 'Remove orphan subscription?' : 'Unsubscribe?',
            message: isOrphan 
                ? `This subscription has no matching card. Are you sure you want to remove it?` 
                : `Are you sure you want to unsubscribe from "${title}"?`,
            okText: 'Confirm',
            okDanger: true,
            onOk: () => {
                // 使用 storageAdapter 更新状态 (触发事件 -> 自动刷新 UI)
                const arr = storageAdapter.getSubscriptions();
                const idx = arr.findIndex(s => String(s.id) === String(sub.id));
                if (idx !== -1) {
                    storageAdapter.updateSubscription({ ...arr[idx], enabled: false });
                    // 事件广播会自动更新 Dashboard 和 Settings
                }
            }
        });
    };

    actions.appendChild(sel);
    actions.appendChild(unsubBtn);
    
    row.appendChild(info);
    row.appendChild(actions);
    container.appendChild(row);
}

function showToast(msg) {
    const ok = document.createElement('div');
    ok.className = 'fixed bottom-6 right-6 z-[100] px-4 py-2 rounded-lg bg-primary text-white text-sm shadow-lg animate-in fade-in slide-in-from-bottom-4';
    ok.textContent = msg;
    document.body.appendChild(ok);
    setTimeout(() => ok.remove(), 1500);
}

function escapeHTML(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
