// 中文注释：通用 API 封装（测试/开发占位版，统一位于 src/js）
// 职责：提供 invokeJSON(name, opts) 入口；在真实环境中可替换为 Supabase Edge Functions 调用

/**
 * 调用后端函数并返回 JSON（占位实现）
 * @param {string} name
 * @param {{ method?: string, headers?: Record<string,string>, body?: any }} opts
 * @returns {Promise<{ data?: any, error?: { message: string }, status?: number }>} 
 */
export async function invokeJSON(name, opts = {}) {
  const method = String(opts?.method || 'GET').toUpperCase();
  // 简单健康检查示例
  if (name === 'health' && method === 'GET') {
    return { data: { ok: true }, status: 200 };
  }
  // 统一默认占位响应
  return { error: { message: 'NOT_IMPLEMENTED' }, status: 501 };
}

export default { invokeJSON };
