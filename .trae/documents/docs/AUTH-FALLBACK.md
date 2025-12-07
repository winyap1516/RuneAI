# AUTH Fallback（开发环境临时策略）

## 背景与问题
- 在 IDE 内置 WebView 或部分浏览器的沙箱环境中，`@supabase/supabase-js` 的会话恢复可能失败，导致 `getSession()` 返回空。
- 结果：前端调用 Edge Functions 时无法附带用户 `Authorization: Bearer <JWT>`，退回到 `anon key`，出现 `401 Missing authorization header` 或 `ERR_ABORTED`。

## 临时解决方案（仅开发环境）
- 在 `js/services/supabaseClient.js` 的 `getAuthHeaders()` 中实现兜底逻辑：
  1. 优先使用 SDK 的 `getSession()` 拿到 `access_token`（来源：`SDK`）。
  2. 若为空且处于非生产环境，尝试从 `localStorage` 中读取 `supabase.auth.token` 或 `sb-*-auth-token`（来源：`localStorage`）。
  3. 若仍为空，退回 `anon`。
- 在 `callFunction()` 中打印开发日志（不含完整 Token）：
  - `[EdgeFn] callFunction: <name> { authSource: SDK|localStorage|anon, authPreview: abcdefgh… }`
- 安全守则：
  - 预览仅显示前 8 位；绝不打印完整 Token。
  - 仅在 `import.meta.env.MODE !== 'production'` 时启用。

## 代码片段（节选，已脱敏）
```js
// js/services/supabaseClient.js
const isDev = import.meta.env?.MODE !== 'production';
let __lastAuthInfo = { source: 'unknown', preview: null };

export async function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  let source = 'anon', token = null;

  // 1) SDK
  const { data } = await supabase.auth.getSession();
  token = data?.session?.access_token; if (token) source = 'SDK';

  // 2) localStorage 兜底（dev-only）
  if (!token && isDev && !window.__DISABLE_AUTH_FALLBACK__) {
    try {
      const raw = localStorage.getItem('supabase.auth.token');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.access_token) { token = parsed.access_token; source = 'localStorage'; }
    } catch {}
  }

  // 3) 设置头与记录上下文
  headers['Authorization'] = token ? `Bearer ${token}` : `Bearer ${config.supabaseAnonKey}`;
  const preview = token ? token.slice(0,8) + '…' : null;
  __lastAuthInfo = { source, preview };
  if (isDev) logger.debug('[AuthHdr] source=', source, 'preview=', preview);
  return headers;
}
```

## 迁移计划（生产替代方案）
- 上云前必须删除 dev-only Fallback（CI 校验 production 构建中不应包含该逻辑）。
- 推荐两种生产鉴权方案：
  1. 后端设置 httpOnly Cookie 保存 Refresh Token；前端仅持 Access Token，并通过服务端续期。
  2. 继续使用官方 SDK，确保 `persistSession: true` 与刷新逻辑可靠；对敏感 Edge Functions 在后端验证身份并使用 `service_role`。

## 回归测试清单
- 登录后 `sync-push` 包含 `Authorization: Bearer <JWT>`，不再报 401。
- 当 SDK 返回空时（模拟），在 dev 环境下 fallback 从 localStorage 读取，`sync-push` 仍成功。
- Logout 场景下：无 Token 直接本地清理，不再抛 `ERR_ABORTED`；有 Token 时网络登出失败也能优雅降级。
- Service Worker：在开发环境禁用或自动注销，确保不干扰认证与页面脚本更新（`js/main.js` 中已实现）。

## 回滚与应急
- 出现问题时可以通过运行时开关 `window.__DISABLE_AUTH_FALLBACK__ = true` 立刻禁用兜底（仅 dev）。
- 如需临时启用 SW，可在控制台设置 `window.__DISABLE_SW = false` 然后刷新；默认 dev 环境 SW 是禁用状态。
- 生产构建不应存在此逻辑；若误入，请立即回滚 PR。

## 变更记录
- v0.1（dev-only）：添加 Fallback 与调试日志；Sync 层失败上下文记录。
