// 中文注释：AI 服务抽象模块
// 作用：统一封装网页抓取与摘要生成逻辑，作为唯一 AI 接口
// 标准化返回格式：{ ok: true, summary: "...", metadata: {...} } 或 { ok: false, error: {...} }

import { normalizeUrl } from '../utils/url.js';
import { mockAIFromUrl as mockAIFromUrlExternal, mockFetchSiteContent as mockFetchSiteContentExternal } from '../../mockFunctions.js';

const SUPABASE_URL = (import.meta?.env?.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta?.env?.VITE_SUPABASE_ANON_KEY || '').trim();
// 中文注释：在 Node/Vitest 环境（无 window）下强制关闭云端调用，保证单测可控
const useCloud = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && typeof window !== 'undefined');

async function fetchAIFromCloud(url) {
  const endpoint = `${SUPABASE_URL}/functions/v1/super-endpoint`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ url })
  });
  if (!res.ok) throw new Error(`Cloud AI failed: ${res.status}`);
  return res.json();
}

// 中文注释：测试友好注入点（仅用于单测环境覆盖下述两项）
let __mockAIFromUrl = mockAIFromUrlExternal;
let __mockFetchSiteContent = mockFetchSiteContentExternal;

/**
 * 中文注释：单测注入钩子，用于替换内部 Mock 实现，避免路径解析差异导致的 vi.mock 失败
 * @param {{ mockAIFromUrl?: Function, mockFetchSiteContent?: Function }} hooks
 */
export function __setTestHooks(hooks = {}) {
  if (typeof hooks.mockAIFromUrl === 'function') __mockAIFromUrl = hooks.mockAIFromUrl;
  if (typeof hooks.mockFetchSiteContent === 'function') __mockFetchSiteContent = hooks.mockFetchSiteContent;
}

export async function fetchSiteContent(url) {
  const nurl = normalizeUrl(url);
  try { return await __mockFetchSiteContent(nurl); } catch { return { content: '' }; }
}

/**
 * Generate digest content for a website
 * @param {object|string} website - Website object or URL string
 * @param {string} type - 'manual' | 'daily' (optional, for context)
 * @returns {Promise<{ok: boolean, summary?: string, metadata?: object, error?: object}>}
 */
export async function createDigestForWebsite(website, type) {
  const url = typeof website === 'string' ? website : website.url;
  const nurl = normalizeUrl(url);

  try {
    let aiResult;
    if (useCloud) {
      aiResult = await fetchAIFromCloud(nurl);
    } else {
      // Mock AI（可被单测注入覆盖）
      aiResult = await __mockAIFromUrl(nurl);
    }

    // 成功格式（必须统一）
    return {
      ok: true,
      summary: aiResult.description || aiResult.summary || 'No summary generated.',
      metadata: {
        title: aiResult.title,
        tags: aiResult.tags,
        category: aiResult.category
      }
    };
  } catch (e) {
    // 失败格式（必须统一）
    // 区分错误类型（简单逻辑）
    let code = 'AI_UNKNOWN_ERROR';
    if (e.message && (e.message.includes('Network') || e.message.includes('failed'))) {
      code = 'AI_NETWORK_ERROR';
    } else if (e.message && e.message.includes('timeout')) {
      code = 'AI_TIMEOUT';
    }

    return {
      ok: false,
      error: {
        code,
        message: e.message || 'AI generation failed',
        raw: e
      }
    };
  }
}

// Deprecated: old generateSummary kept for compatibility if needed, but redirected to new logic or removed if unused.
// Considering instructions, we should enforce createDigestForWebsite usage.
// We keep fetchSiteContent as it's a utility.

export default { fetchSiteContent, createDigestForWebsite };
