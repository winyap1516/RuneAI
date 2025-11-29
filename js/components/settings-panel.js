// 中文注释：订阅设定页面交互脚本（集中管理抓取频率）
// 中文注释：该模块提供 window.renderSubscriptionsSettings()，在设置面板打开后渲染订阅列表

import storageAdapter from '../storage/storageAdapter.js';
import { openConfirm } from '../utils/dom.js';

// 中文注释：频率选项映射（与 js/main.js 保持一致）
const FREQ_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'every_1m', label: 'Every 1 minute (dev)' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'every_6h', label: 'Every 6 hours' },
  { value: 'daily', label: 'Daily' },
];

function normalizeForCompare(raw = '') {
  const s = String(raw).trim();
  if (!s) return '';
  const guess = /^(https?:)?\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(guess);
    const path = String(u.pathname || '').replace(/\/+$/, '');
    return `${u.hostname.toLowerCase()}${path}`;
  } catch {
    return String(guess).toLowerCase().replace(/\/+$/, '');
  }
}

// 中文注释：渲染订阅设定列表（名称/URL/频率下拉），变更即保存
window.renderSubscriptionsSettings = function renderSubscriptionsSettings() {
  const wrap = document.getElementById('subsSettingsList');
  if (!wrap) return;
  const subs = storageAdapter.getSubscriptions();
  wrap.innerHTML = '';
  // 批量操作工具栏
  const toolbar = document.createElement('div');
  toolbar.className = 'flex items-center justify-between mb-2';
  toolbar.innerHTML = `
    <div class="text-sm font-semibold">Subscription Settings</div>
    <div class="flex items-center gap-2">
      <button id="bulkUnsubBtn" class="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-white/10" disabled>Bulk Unsubscribe</button>
      <button id="bulkDeleteBtn" class="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white" disabled>Bulk Delete</button>
    </div>`;
  wrap.appendChild(toolbar);
  const selected = new Set();
  const refreshToolbar = () => {
    const dis = selected.size === 0;
    const unsubBtn = document.getElementById('bulkUnsubBtn');
    const delBtn = document.getElementById('bulkDeleteBtn');
    if (unsubBtn) unsubBtn.disabled = dis;
    if (delBtn) delBtn.disabled = dis;
  };
  if (!Array.isArray(subs) || subs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-sm text-text-secondary-light dark:text-text-secondary-dark';
    empty.textContent = 'No subscriptions';
    wrap.appendChild(empty);
    return;
  }
  subs.forEach((sub) => {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between p-3 border rounded-lg';
    const left = document.createElement('div');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'mr-2';
    chk.addEventListener('change', () => { if (chk.checked) selected.add(sub.id); else selected.delete(sub.id); refreshToolbar(); });
    left.appendChild(chk);
    const info = document.createElement('div');
    info.innerHTML = `
      <div class="text-sm font-medium">${(sub.title||sub.url||'').toString()}</div>
      <div class="text-xs text-gray-500">${(sub.url||'').toString()}</div>
    `;
    left.appendChild(info);
    const right = document.createElement('div');
    const sel = document.createElement('select');
    sel.className = 'px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
    FREQ_OPTIONS.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value; o.textContent = opt.label; right.appendChild(sel);
      sel.appendChild(o);
    });
    sel.value = String(sub.frequency || 'daily');
    sel.addEventListener('change', () => {
      const next = sel.value || 'daily';
      const arr = storageAdapter.getSubscriptions();
      const idx = arr.findIndex(s => String(s.id) === String(sub.id));
      if (idx !== -1) {
        storageAdapter.updateSubscription({ ...arr[idx], frequency: next, lastChecked: arr[idx].lastChecked || 0 });
        try {
          const ok = document.createElement('div');
          ok.className = 'fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-primary text-white text-sm shadow-lg';
          ok.textContent = 'Settings saved';
          document.body.appendChild(ok);
          setTimeout(() => ok.remove(), 1400);
        } catch {}
      }
    });
    // 订阅启用开关
    const toggle = document.createElement('button');
    toggle.className = 'ml-2 px-3 py-1.5 text-sm rounded-lg ' + (sub.enabled!==false ? 'bg-primary text-white' : 'bg-gray-100');
    toggle.textContent = sub.enabled!==false ? 'Enabled' : 'Disabled';
    toggle.addEventListener('click', () => {
      const arr = storageAdapter.getSubscriptions();
      const idx = arr.findIndex(s => String(s.id) === String(sub.id));
      if (idx !== -1) {
        const nextEn = !(arr[idx].enabled!==false);
        storageAdapter.updateSubscription({ ...arr[idx], enabled: nextEn });
        toggle.className = 'ml-2 px-3 py-1.5 text-sm rounded-lg ' + (nextEn ? 'bg-primary text-white' : 'bg-gray-100');
        toggle.textContent = nextEn ? 'Enabled' : 'Disabled';
      }
    });
    right.appendChild(sel);
    right.appendChild(toggle);
    row.appendChild(left);
    row.appendChild(right);
    wrap.appendChild(row);
  });
  // 批量操作绑定
  const bulkUnsub = document.getElementById('bulkUnsubBtn');
  const bulkDelete = document.getElementById('bulkDeleteBtn');
  if (bulkUnsub) bulkUnsub.addEventListener('click', () => {
    const arr = storageAdapter.getSubscriptions();
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    openConfirm({
      title: 'Bulk Unsubscribe',
      message: `Unsubscribe ${ids.length} selected sites?`,
      okText: 'Unsubscribe',
      onOk: () => {
        ids.forEach(id => {
          const idx = arr.findIndex(s => String(s.id) === String(id));
          if (idx !== -1) storageAdapter.updateSubscription({ ...arr[idx], enabled: false });
        });
        window.renderSubscriptionsSettings();
      }
    });
  });
  if (bulkDelete) bulkDelete.addEventListener('click', () => {
    const arr = storageAdapter.getSubscriptions();
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    openConfirm({
      title: 'Bulk Delete',
      message: `Delete ${ids.length} saved links? This will remove related digest entries.`,
      okDanger: true,
      okText: 'Delete',
      onOk: () => {
        ids.forEach(subId => {
          const sub = arr.find(x => String(x.id) === String(subId));
          if (sub) {
            // 尝试找到对应的 Link 并删除
            const links = storageAdapter.getLinks();
            const link = links.find(l => normalizeForCompare(l.url) === normalizeForCompare(sub.url));
            if (link) {
              storageAdapter.deleteLink(link.id);
            } else {
              // 如果只有订阅没有 Link（孤儿订阅），直接删订阅
              storageAdapter.deleteSubscriptionByUrl(sub.url);
            }
          }
        });
        window.renderSubscriptionsSettings();
      }
    });
  });
};
