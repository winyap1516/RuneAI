// mockFunctions.js
// ✅ 本地开发模式下的 AI 模拟函数
// 说明：当 USE_LOCAL_DB 为 true 时，前端调用此函数返回虚拟 AI 内容，避免依赖 Supabase/OpenAI。

/**
 * 根据 URL 生成模拟的 AI 内容
 * @param {string} url - 用户输入的链接地址
 * @returns {Promise<{title:string, description:string, category:string, tags:string[]}>}
 */
export async function mockAIFromUrl(url) {
  // 简单的 URL 特征派生：用于生成标题/标签
  const u = (url || '').toLowerCase();
  const host = u.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || 'example.com';
  const isAI = /ai|ml|openai|anthropic|gemini|llm|gpt/.test(u);
  const isDesign = /design|ui|ux|figma|dribbble|behance/.test(u);
  const isProductivity = /productivity|todo|notes|task|workflow|automation/.test(u);

  const category = isAI ? 'AI Research' : isDesign ? 'Design Inspiration' : isProductivity ? 'Productivity Tools' : 'All Links';
  const title = host.split('.').slice(0, -1).join(' ').replace(/-/g, ' ') || 'Untitled';
  const tags = [
    isAI ? 'ai' : null,
    isDesign ? 'design' : null,
    isProductivity ? 'productivity' : null,
    host.includes('github') ? 'code' : null,
  ].filter(Boolean);

  return {
    title: title ? title.charAt(0).toUpperCase() + title.slice(1) : 'Untitled',
    description: `Mock: 自动生成的摘要，基于 URL 特征与本地模式。来源域名：${host}`,
    category,
    tags: tags.length ? tags : ['bookmark']
  };
}

/**
 * 中文注释：Mock 抓取网站内容（解决跨域与无真实内容的情况）。
 * 返回站点快照文本与时间戳，可供 Digest 生成与记录 raw 使用。
 * @param {string} url
 * @returns {Promise<{content:string, timestamp:number}>}
 */
export async function mockFetchSiteContent(url) {
  const now = new Date().toISOString();
  const host = String(url || '').replace(/^https?:\/\//, '').split('/')[0] || 'example.com';
  return {
    content: `Mocked content for ${url}. Host: ${host}. Latest update: ${now}.`,
    timestamp: Date.now()
  };
}
