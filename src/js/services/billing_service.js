// 中文注释：计费服务模块（src/js 统一路径）
// 职责：提供配额读取、结账会话创建、管理员设置配额的前端封装；当前为占位实现以满足测试

/**
 * 读取当前用户配额（占位）
 */
export async function getMyQuota() {
  return { daily_limit: 5, used_today: 0, extra_credits: 0 };
}

/**
 * 创建结账会话（占位，返回跳转 URL）
 */
export async function createCheckoutSession(plan, options = {}) {
  if (!plan) return { error: { message: 'PLAN_REQUIRED' } };
  return { url: `https://checkout.example.local/session/${encodeURIComponent(String(plan))}` };
}

/**
 * 管理员设置配额（占位，回显参数）
 */
export async function adminSetQuota({ user_id, daily_limit, extra_credits = 0 }) {
  if (!user_id) return { error: { message: 'USER_ID_REQUIRED' } };
  return { ok: true, user_id, daily_limit, extra_credits };
}

export default { getMyQuota, createCheckoutSession, adminSetQuota };
