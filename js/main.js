// main.js
import { initDashboard } from './features/dashboard.js';
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

  // 模拟已登录用户
  const user = { nickname: 'SoloDev', avatar: '', email: 'solo@example.com' };
  localStorage.setItem('runeai_user', JSON.stringify(user));

  // 初始化页面
  initDashboard(user);

  // =============================
  // ⏱️ 本地 Scheduler（Dev 模式）
  // =============================
  if (import.meta?.env?.DEV) {
    const STORAGE_KEYS = { subs: 'rune_subscriptions', digests: 'rune_digests' };
    const load = (k, f=[]) => { try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; } catch { return f; } };
    const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

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
      sub.inProgress = true; sub.status = 'in_progress'; save(STORAGE_KEYS.subs, load(STORAGE_KEYS.subs, []).map(s => s.id===sub.id?sub:s));
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
          const subs = load(STORAGE_KEYS.subs, []);
          const idx = subs.findIndex(s => s.id === sub.id);
          if (idx !== -1) { subs[idx] = sub; save(STORAGE_KEYS.subs, subs); }
          return;
        }
        const entry = {
          subscriptionId: sub.id,
          url: normalizeUrl(sub.url),
          title: ai.title || sub.title || sub.url,
          summary: ai.description || (site?.content||'').slice(0,500) || 'Mock: 摘要占位',
          highlights: Array.isArray(ai.tags) ? ai.tags : [],
          raw: { site, ai }
        };
        const digests = load(STORAGE_KEYS.digests, []);
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
          digests.push(merged);
        }
        save(STORAGE_KEYS.digests, digests);
        sub.lastChecked = Date.now();
        sub.lastHash = currentHash;
        sub.inProgress = false;
        sub.status = 'ok';
        const subs = load(STORAGE_KEYS.subs, []);
        const idx = subs.findIndex(s => s.id === sub.id);
        if (idx !== -1) { subs[idx] = sub; save(STORAGE_KEYS.subs, subs); }
        try {
          const toast = document.createElement('div');
          toast.className = 'fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-primary text-white text-sm shadow-lg';
          toast.textContent = `已更新合并日报（${merged.siteCount} sites）`;
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 1800);
        } catch {}
      } catch (e) {
        const digests = load(STORAGE_KEYS.digests, []);
        let merged = digests.find(d => d.date === dateStr && d.merged === true);
        const entry = { subscriptionId: sub.id, url: sub.url, title: sub.title||sub.url, summary: '抓取失败', highlights: [], raw: { error: String(e?.message||e) } };
        if (merged) { (merged.entries||[]).push(entry); merged.entries = merged.entries||[]; merged.siteCount = merged.entries.length; merged.updated_at = Date.now(); }
        else { digests.push({ id: `digest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`, date: dateStr, merged: true, title: `AI Digest · ${dateStr}`, siteCount: 1, entries: [entry], created_at: Date.now() }); }
        save(STORAGE_KEYS.digests, digests);
        sub.inProgress = false; sub.status = 'error'; sub.lastError = String(e?.message||e);
        const subs = load(STORAGE_KEYS.subs, []); const idx = subs.findIndex(s => s.id === sub.id); if (idx!==-1) { subs[idx]=sub; save(STORAGE_KEYS.subs, subs);}        
      }
    }

    async function checkAllSubscriptions() {
      const subs = load(STORAGE_KEYS.subs, []);
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
