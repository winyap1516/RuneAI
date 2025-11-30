// 中文注释：AI 服务抽象模块
// 作用：统一封装网页抓取与摘要生成逻辑，便于本地/云端切换
// - fetchSiteContent(url): 抓取网页内容（本地开发使用 Mock）
// - generateSummary(url): 生成摘要（默认走 Mock，云端可切换 Supabase Edge Functions）
// - createDigestForWebsite(website, type): 为指定网站创建摘要记录（type: 'manual'|'daily'）

import storageAdapter from '../storage/storageAdapter.js'
import { normalizeUrl } from '../utils/url.js'
import { mockAIFromUrl as mockAIFromUrlExternal, mockFetchSiteContent as mockFetchSiteContentExternal } from '../../mockFunctions.js'

const SUPABASE_URL = (import.meta?.env?.VITE_SUPABASE_URL || '').trim()
const SUPABASE_ANON_KEY = (import.meta?.env?.VITE_SUPABASE_ANON_KEY || '').trim()
const useCloud = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

async function fetchAIFromCloud(url) {
  const endpoint = `${SUPABASE_URL}/functions/v1/super-endpoint`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ url })
  })
  if (!res.ok) throw new Error(`Cloud AI failed: ${res.status}`)
  return res.json()
}

export async function fetchSiteContent(url) {
  const nurl = normalizeUrl(url)
  try { return await mockFetchSiteContentExternal(nurl) } catch { return { content: '' } }
}

export async function generateSummary(url) {
  const nurl = normalizeUrl(url)
  if (useCloud) {
    try { return await fetchAIFromCloud(nurl) } catch {}
  }
  return mockAIFromUrlExternal(nurl)
}

export async function createDigestForWebsite(website, type) {
  // 中文注释：统一创建摘要记录，并写入审计日志
  const userId = storageAdapter.getUser()?.id || 'local-dev'
  const ai = await generateSummary(website.url)
  const summaryText = ai?.description || (await fetchSiteContent(website.url))?.content?.slice(0,500) || 'No summary'
  const record = await storageAdapter.addDigest({ website_id: website.website_id || website.id, summary: summaryText, type })
  storageAdapter.addGenerationLog({ userId, type: type === 'daily' ? 'daily' : 'single', linkId: website.website_id || website.id, status: 'success' })
  return record
}

export default { fetchSiteContent, generateSummary, createDigestForWebsite }

