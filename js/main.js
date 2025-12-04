// main.js
import { initDashboard } from './features/dashboard.js';
import { initAuthUI } from './features/auth_ui.js';
import storageAdapter from './storage/storageAdapter.js';
// 中文注释：引入本地 Mock 抓取与 AI 摘要（用于订阅与日报生成）
import { mockFetchSiteContent, mockAIFromUrl } from '../mockFunctions.js';
// 中文注释：引入订阅设定面板交互脚本（在设置面板打开时渲染订阅列表）
import './components/settings-panel.js';

// 中文注释：URL 规范化（与 dashboard.js 保持一致），用于 Digest 合并与去重
function normalizeUrl(raw = '') {
  const s = String(raw).trim();
  if (!s) return '';
  const guess = /^(https?:)?\/\//i.test(s) ? s : `https://${s}`;
  try { const u = new URL(guess); u.hostname = u.hostname.toLowerCase(); return u.toString(); } catch { return ''; }
}

// 中文注释：轻量文本哈希（djb2），用于内容差异检测；避免重复生成摘要
function hashText(text = '') {
  let hash = 5381; const str = String(text);
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) + hash) + str.charCodeAt(i); hash &= 0xffffffff; }
  return `h${hash >>> 0}`;
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 RuneAI Dashboard Loaded');

  // 中文注释：提供站点数据一键清理工具（用于开发者预览浏览器缓存问题的快速排障）
  // 快捷键：Ctrl + Alt + C
  // 作用：清理 Cache Storage / IndexedDB / LocalStorage / SessionStorage，并注销 Service Worker，随后强制刷新
  window.__clearSiteData = async () => {
    try {
      // 1) 清理 Cache Storage
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));

      // 2) 清理 IndexedDB（若浏览器支持 databases()，逐个删除）
      if (indexedDB && typeof indexedDB.databases === 'function') {
        try {
          const dbs = await indexedDB.databases();
          await Promise.all(dbs.map(db => db?.name && indexedDB.deleteDatabase(db.name)));
        } catch (e) {
          console.warn('[CacheClean] IndexedDB.databases() 不支持或失败，跳过 IndexedDB 全量清理', e);
        }
      }

      // 3) 清理 LocalStorage / SessionStorage
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}

      // 4) 注销所有 Service Worker
      if (navigator.serviceWorker) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        } catch {}
      }

      // 5) 强制刷新页面
      location.reload(true);
    } catch (e) {
      console.error('[CacheClean] 清理失败：', e);
    }
  };

  // 注册快捷键 Ctrl + Alt + C
  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey; // macOS 使用 Cmd
    if (ctrl && e.altKey && (e.key.toLowerCase() === 'c')) {
      e.preventDefault();
      console.log('[CacheClean] 执行站点数据清理…');
      window.__clearSiteData();
    }
  });

  // 模拟已登录用户（开发者模式固定账号）
  const user = {
    id: 'local-dev',
    nickname: 'Developer',
    email: 'dev@local',
    avatar: 'https://i.pravatar.cc/100?img=12'
  };
  storageAdapter.saveUser(user);

  // 检测 IDE WebView 环境并警告 (仅 Dev)
  const isDev = import.meta?.env?.MODE !== 'production';
  if (isDev) {
    const isWebView = !window.navigator.webdriver && (
       /Code|VSCode|Trae|IDE/i.test(navigator.userAgent) || 
       window.location.protocol === 'vscode-webview:' ||
       window.innerWidth < 500 // 简单启发式
    );
    if (isWebView) {
      console.error('[RuneAI] ⚠️ 严重警告：检测到正在使用 IDE 内置 WebView');
      console.error('内置浏览器处于沙箱模式，会阻断 Supabase 认证与 Edge Function 调用。');
      console.error('👉 请务必点击 IDE 右上角 "Open in Browser" 或手动访问 http://localhost:5173');
      
      // 可选：在页面顶部插入醒目 Banner
      const banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#ff4444;color:white;padding:12px;text-align:center;font-weight:bold;box-shadow:0 2px 10px rgba(0,0,0,0.2);';
      banner.innerHTML = '⚠️ 开发模式警告：请勿使用 IDE 内置浏览器！<br/><span style="font-weight:normal;font-size:0.9em">沙箱环境会导致登录与同步失败。请点击 "Open in Browser" 或访问 http://localhost:5173</span>';
      document.body.appendChild(banner);
    }
  }

  // Phase 5: Register Service Worker
  if ('serviceWorker' in navigator) {
    // 中文注释：开发环境默认禁用 SW（避免预缓存导致的旧页面/脚本与认证异常）；可通过 window.__DISABLE_SW = false 重新启用
    if (isDev && window.__DISABLE_SW !== false) {
      navigator.serviceWorker.getRegistrations()
        .then(regs => Promise.all(regs.map(r => r.unregister())))
        .then(() => console.warn('[SW] Dev mode: unregistered all Service Workers'))
        .catch(() => {});
    } else {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => console.log('[SW] Registered:', reg.scope))
          .catch(err => console.warn('[SW] Registration failed:', err));
      });
    }
  }

  // 初始化页面
  // P0: Ensure migration runs before rendering
  (async () => {
    try {
      await storageAdapter.migrateToIdBased();
    } catch (e) {
      console.error("Migration failed:", e);
    }
    
    // Phase 5: 如果是 dashboard 页，不在此初始化（由 dashboard_init.js 接管）
    // 或者保持 initDashboard 的调用，但要避免重复 Auth
    // 目前 dashboard.html 会加载 dashboard_init.js，所以这里我们保留通用逻辑
    // 但要根据当前页面判断
    
    if (!window.location.pathname.includes('dashboard.html')) {
       initAuthUI('global'); // 仅在非 dashboard 页初始化全局监听（如 Landing）
    } else {
       // Dashboard 页初始化逻辑移至 dashboard_init.js
       initDashboard(user);
    }
  })();

  // =============================
  // ⏱️ 本地 Scheduler（Dev 模式）
  // =============================
  if (import.meta?.env?.DEV) {
    const STORAGE_KEYS = { subs: 'rune_subscriptions', digests: 'rune_digests' };

    function frequencyToMs(freq) {
      const f = String(freq || 'daily').toLowerCase();
      switch (f) {
        case 'every_1m': return 60 * 1000;
        case 'hourly': return 60 * 60 * 1000;
        case 'every_6h': return 6 * 60 * 60 * 1000;
        case 'daily': return 24 * 60 * 60 * 1000;
        case 'manual': return Infinity; // 中文注释：手动订阅不参与自动调度
        default:
          console.warn('Unknown frequency:', freq, 'fallback to daily');
          return 24 * 60 * 60 * 1000;
      }
    }

    async function tryFetchRealSite(url) {
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        return { content: text, timestamp: Date.now() };
      } catch { return null; }
    }

    async function processSubscription(sub) {
      if (!sub?.enabled) return;
      if (sub?.inProgress) return;
      sub.inProgress = true; sub.status = 'in_progress'; 
      await storageAdapter.updateSubscription(sub);
      
      const dateStr = new Date().toISOString().slice(0,10);
      try {
        let site = await tryFetchRealSite(sub.url);
        if (!site) site = await mockFetchSiteContent(sub.url);
        const ai = await mockAIFromUrl(sub.url);
        const currentHash = hashText(site?.content || '');
        // 中文注释：若内容未变化，仅更新检查时间与状态，不写入 Digest
        if (currentHash && sub.lastHash && currentHash === sub.lastHash) {
          sub.lastChecked = Date.now();
          sub.inProgress = false;
          sub.status = 'ok';
          await storageAdapter.updateSubscription(sub);
          return;
        }
        const entry = {
          subscriptionId: sub.id,
          url: normalizeUrl(sub.url),
          title: ai.title || sub.title || sub.url,
          summary: ai.description || (site?.content||'').slice(0,500) || 'Mock: Summary placeholder',
          highlights: Array.isArray(ai.tags) ? ai.tags : [],
          raw: { site, ai }
        };
        const digests = await storageAdapter.getDigests();
        let merged = digests.find(d => d.date === dateStr && d.merged === true);
        if (merged) {
          const exist = new Set((merged.entries||[]).map(e=>normalizeUrl(e.url)));
          if (!exist.has(normalizeUrl(entry.url))) { (merged.entries||[]).push(entry); merged.entries = merged.entries||[]; }
          merged.siteCount = merged.entries.length;
          merged.updated_at = Date.now();
        } else {
          merged = {
            id: `digest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,
            date: dateStr,
            merged: true,
            title: `AI Digest · ${dateStr}`,
            siteCount: 1,
            entries: [entry],
            created_at: Date.now()
          };
        }
        await storageAdapter.addDigest(merged);
        
        sub.lastChecked = Date.now();
        sub.lastHash = currentHash;
        sub.inProgress = false;
        sub.status = 'ok';
        await storageAdapter.updateSubscription(sub);
        
        try {
          const toast = document.createElement('div');
          toast.className = 'fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-primary text-white text-sm shadow-lg';
          toast.textContent = `Merged digest updated (${merged.siteCount} sites)`;
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 1800);
        } catch {}
      } catch (e) {
        const digests = await storageAdapter.getDigests();
        let merged = digests.find(d => d.date === dateStr && d.merged === true);
        const entry = { subscriptionId: sub.id, url: sub.url, title: sub.title||sub.url, summary: 'Fetch failed', highlights: [], raw: { error: String(e?.message||e) } };
        if (merged) { (merged.entries||[]).push(entry); merged.entries = merged.entries||[]; merged.siteCount = merged.entries.length; merged.updated_at = Date.now(); }
        else { merged = { id: `digest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`, date: dateStr, merged: true, title: `AI Digest · ${dateStr}`, siteCount: 1, entries: [entry], created_at: Date.now() }; }
        await storageAdapter.addDigest(merged);
        
        sub.inProgress = false; sub.status = 'error'; sub.lastError = String(e?.message||e);
        await storageAdapter.updateSubscription(sub);
      }
    }

    async function checkAllSubscriptions() {
      const subs = await storageAdapter.getSubscriptions();
      const now = Date.now();
      for (const sub of subs) {
        const interval = frequencyToMs(sub.frequency);
        if (!isFinite(interval)) continue; // 中文注释：手动订阅跳过自动处理
        if (now - (sub.lastChecked || 0) >= interval) {
          await processSubscription(sub);
        }
      }
    }

    // 每分钟检查一次（Dev 可设置为 every_1m）
    setInterval(checkAllSubscriptions, 60 * 1000);
  }
});
