// 中文注释：订阅设定页面交互脚本（集中管理抓取频率）
// 中文注释：该模块提供 window.renderSubscriptionsSettings()，在设置面板打开后渲染订阅列表

import storageAdapter from '../utils/storageAdapter.js';

// 中文注释：频率选项映射（与 js/main.js 保持一致）
const FREQ_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'every_1m', label: 'Every 1 minute (dev)' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'every_6h', label: 'Every 6 hours' },
  { value: 'daily', label: 'Daily' },
];

// 中文注释：渲染订阅设定列表（名称/URL/频率下拉），变更即保存
window.renderSubscriptionsSettings = function renderSubscriptionsSettings() {
  const wrap = document.getElementById('subsSettingsList');
  if (!wrap) return;
  const subs = storageAdapter.loadSubscriptions();
  wrap.innerHTML = '';
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
    left.innerHTML = `
      <div class="text-sm font-medium">${(sub.title||sub.url||'').toString()}</div>
      <div class="text-xs text-gray-500">${(sub.url||'').toString()}</div>
    `;
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
      const arr = storageAdapter.loadSubscriptions();
      const idx = arr.findIndex(s => String(s.id) === String(sub.id));
      if (idx !== -1) {
        storageAdapter.saveSubscription({ ...arr[idx], frequency: next, lastChecked: arr[idx].lastChecked || 0 });
        try {
          const ok = document.createElement('div');
          ok.className = 'fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-primary text-white text-sm shadow-lg';
          ok.textContent = 'Settings saved';
          document.body.appendChild(ok);
          setTimeout(() => ok.remove(), 1400);
        } catch {}
      }
    });
    right.appendChild(sel);
    row.appendChild(left);
    row.appendChild(right);
    wrap.appendChild(row);
  });
};
