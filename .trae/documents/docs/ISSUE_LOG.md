# Issue Log

## Issue #6 — 实现 OAuth Provider 绑定与映射（已完成 P0）
- 描述：新增 `auth_providers` 表与 Edge Function `/oauth-link-callback`；前端回调统一调用并处理登录映射。
- 变更：
  - `supabase/migrations/phase9/001_auth_providers.sql`（表与 RLS）
  - `supabase/migrations/phase9/002_auth_provider_audits.sql`（审计日志表）
  - `supabase/functions/oauth-link-callback/index.ts`（服务端绑定与 magiclink 映射，使用 service_role）
  - `js/views/oauth_callback.js`（回调处理与统一重定向）
  - `js/features/account_settings.js`（新增 Link Google/Apple 流程入口）
- 状态：已完成（P0），生产合并策略另行规划
- 优先级：High

## Issue #7 — Settings 页面“Link Google/Apple”状态签名（未解决）
- 描述：state 需 HMAC 签名防止篡改；目前为 Base64 编码。
- 状态：未解决
- 优先级：High

## Issue #8 — 重复用户合并策略（未解决）
- 描述：决定自动/人工合并；实现 Edge Function、数据迁移与审计、回滚与备份。
- 状态：未解决
- 优先级：Medium

## Issue #9 — OAuth Linking/Mapping E2E 覆盖（未解决）
- 描述：使用测试环境或本地 Supabase 进行端到端覆盖（Link → Callback → 写入 → 映射）。
- 状态：未解决
- 优先级：Medium

## Issue #10 — 安全审计（未解决）
- 描述：验证 service_role key 仅在 Edge 后端可用；确保构建不泄露敏感变量。
- 状态：未解决
- 优先级：High

## Issue #1 — 统一登录跳转为 login.html（已修复）
- 症状：登出跳 `index.html`，Dashboard 守卫跳 `login.html`，造成路径不一致。
- 修改：
  - `js/features/auth_ui.js:127-131` 统一登出后跳转 `login.html`。
  - `js/dashboard_init.js:16-19` 明确守卫日志并跳 `login.html`。
- 验收：未登录访问 `dashboard.html` 与任意页面登出，均进入 `login.html`；各浏览器环境一致。

## Issue #2 — 生产环境必须 JWT-only（已修复）
- 症状：`getAuthHeaders()` 无 JWT 时回退到 `anon key/localStorage`，存在安全风险。
- 修改：`js/services/supabaseClient.js:93-143` 在 `import.meta.env.PROD` 时无 JWT 直接抛错 `JWT_REQUIRED`；Dev 下仅在 `window.__ALLOW_DEV_AUTH_FALLBACK__` 显式启用时允许回退。
- 验收：本地可切换 fallback；生产不可用；无 JWT 调用 Edge Functions 返回 401。

## Issue #3 — OAuth 登录入口统一为回调页（已修复）
- 症状：Google 登录回跳路径不一致，且无法实现登录映射到主账号。
- 修改：`js/features/auth_ui.js:265-273` 统一重定向到 `${config.frontendBaseUrl}/oauth-callback.html?action=login`；新增 `public/oauth-callback.html` 与 `js/views/oauth_callback.js` 进行映射处理；新增 Edge Function `supabase/functions/oauth-link-callback/index.ts`。
- 验收：Google 登录进入回调页进行登录映射；若已绑定则跳转 magic link 切换到主账号，否则保持当前并进入仪表盘。

## Issue #4 — Base URL 条件校验（已修复）
- 症状：`config.validate()` 强制要求 `VITE_FRONTEND_BASE_URL`。
- 修改：`js/services/config.js:17-21` 改为条件校验，未设置时警告但不阻断。
- 验收：未使用邮箱回跳/OAuth 启动正常；使用上述功能时需配置 Base URL。

## Issue #5 — 重复 modal_login.html（已修复）
- 症状：`/components/modal_login.html` 与 `/public/components/modal_login.html` 重复。
- 修改：删除根目录版本，统一引用 `public/components/modal_login.html`。
- 验收：路径引用正确，本地运行无 404，文件唯一。
