// 中文注释：本地 Mock 函数集合（用于开发与单测）
// 作用：提供可控的网页抓取与 AI 摘要结果，避免依赖真实网络与云端服务

/**
 * 中文注释：模拟抓取网站内容（返回 data.content）
 * @param {string} url 规范化后的网址
 * @returns {Promise<{data: { url: string, content: string }}>} 模拟返回
 */
export async function mockFetchSiteContent(url) {
  const safeUrl = String(url || '').trim();
  // 返回简单 HTML 片段，便于后续解析或摘要生成
  return {
    data: {
      url: safeUrl,
      content: `<!doctype html><html><head><title>Mock ${safeUrl}</title></head><body><h1>${safeUrl}</h1><p>Mock content for testing.</p></body></html>`
    }
  };
}

/**
 * 中文注释：模拟 AI 摘要生成（返回标准化 data 字段）
 * @param {string} url 规范化后的网址
 * @returns {Promise<{data: { title: string, description: string, tags: string[], category: string }}>} 摘要结构
 */
export async function mockAIFromUrl(url) {
  const safeUrl = String(url || '').trim();
  // 生成可预测的标题与描述，便于测试断言
  return {
    data: {
      title: `Mock Title - ${safeUrl}`,
      description: `Mock Summary for ${safeUrl}: this is a generated description used in tests.`,
      tags: ['mock', 'test', 'ai'],
      category: 'General'
    }
  };
}

/**
 * 中文注释：默认导出（便于按需导入）
 */
export default { mockFetchSiteContent, mockAIFromUrl };

