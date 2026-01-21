// 中文注释：AI 服务抽象模块
// 作用：统一封装网页抓取与摘要生成逻辑，作为唯一 AI 接口
// 标准化返回格式：{ ok: true, summary: "...", metadata: {...} } 或 { ok: false, error: {...} }

import { normalizeUrl, ensureAbsoluteUrl } from '/src/js/utils/url.js';
import { mockAIFromUrl as mockAIFromUrlExternal, mockFetchSiteContent as mockFetchSiteContentExternal } from '/src/mockFunctions.js';
import { config } from '/src/js/services/config.js';
import { callFunction } from '/src/js/services/supabaseClient.js';

const SUPABASE_URL = (import.meta?.env?.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta?.env?.VITE_SUPABASE_ANON_KEY || '').trim();
// 中文注释：在 Mock 模式下强制关闭云端调用；Node/Vitest（无 window）也关闭，保证可控；加入空值保护
const useCloud = !(config && config.useMock) && Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && typeof window !== 'undefined');

async function fetchAIFromCloud(url) {
  // 中文注释：统一通过 supabaseClient.callFunction 调用 Edge，保证附带用户 JWT 与 apikey
  const resp = await callFunction('super-endpoint', { method: 'POST', body: JSON.stringify({ url }) });
  if (!resp.ok) throw new Error(`Cloud AI failed: ${resp.status}`);
  return resp.json();
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
  try {
    const resp = await __mockFetchSiteContent(nurl);
    return (resp && typeof resp === 'object' && 'data' in resp) ? (resp.data || {}) : resp;
  } catch {
    return { content: '' };
  }
}

/**
 * Generate digest content for a website
 * @param {object|string} website - Website object or URL string
 * @param {string} type - 'manual' | 'daily' (optional, for context)
 * @param {string} linkId - Optional link ID to target specific link in Cloud function
 * @returns {Promise<{ok: boolean, summary?: string, metadata?: object, error?: object}>}
 */
export async function createDigestForWebsite(website, type, linkId = null) {
  // 中文注释：同时计算归一化（用于去重）与绝对地址（用于云端抓取）
  const url = typeof website === 'string' ? website : website.url;
  const nurl = normalizeUrl(url);
  const absolute = ensureAbsoluteUrl(url);

  try {
    let aiResult;
    if (useCloud) {
      // 中文注释：云端调用必须使用带协议的绝对 URL，否则函数会返回 INVALID_URL
      // 区分 super-endpoint (元数据) 和 generate-digest (日报)
      // 如果是为了生成 Digest，应该调用 generate-digest
      
      // 注意：之前的实现混淆了 super-endpoint (元数据) 和 Digest 生成
      // super-endpoint 返回 { data: { title, description, tags } }
      // generate-digest 返回 { digest: { summary, ... } }
      
      // 根据 linkId 的存在与否，或者调用者的意图来区分
      // digestController 调用时传入了 linkId，且意图是生成 Digest
      // 所以我们应该调用 generate-digest
      
      const userId = (await import('../storage/storageAdapter.js')).default.getUser()?.id;
      
      // 调用 generate-digest
      const resp = await callFunction('generate-digest', { 
          method: 'POST', 
          body: JSON.stringify({ 
              user_id: userId,
              mode: type || 'manual',
              link_id: linkId
          }) 
      });
      
      if (!resp.ok) throw new Error(`Cloud Digest failed: ${resp.status}`);
      const json = await resp.json();
      
      // 适配返回格式
      aiResult = {
          summary: json.digest?.summary,
          title: json.digest?.metadata?.title,
          // 中文注释：Digest 通常不返回 tags；为与单测期望一致，缺省时返回 undefined
          tags: json.digest?.metadata?.tags ?? undefined,
          // 中文注释：category 也采用缺省 undefined 的策略，避免强制覆盖
          category: json.digest?.metadata?.category ?? undefined
      };

    } else {
      // Mock AI（可被单测注入覆盖）
      aiResult = await __mockAIFromUrl(nurl);
    }

    // 成功格式（必须统一）
    return {
      ok: true,
      summary: (aiResult?.summary || aiResult?.description || 'No summary generated.'),
      metadata: {
        title: aiResult?.title,
        // 中文注释：与测试保持一致：当无 tags/category 时返回 undefined，而非空数组
        tags: Array.isArray(aiResult?.tags) ? aiResult.tags : undefined,
        category: aiResult?.category ?? undefined
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
