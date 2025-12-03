# Auth UI 规范（UI → SDK 接口契约）

## 页面与流程
- 入口：`index.html` → `login.html`
- 登录：`login.html` → 成功后 `dashboard.html`
- 注册：`register.html` → 显示“检查邮箱”提示 → 用户返回登录
- 访问控制：`dashboard.html` 加载时检查 Session，无则跳转 `login.html`

## 字段定义
- 登录表单（login.html）
  - `email`: string
  - `password`: string
  - `remember`: boolean（可选）
- 注册表单（register.html）
  - `email`: string
  - `password`: string
  - `confirm_password`: string
  - `nickname`: string（可选）

## 事件与约定
- `loginSubmit({ email, password, remember })`
  - 若 `remember===true` 且 `supabase.auth.getSession()` 有效 → 直接 `redirect: dashboard.html`
  - 否则调用 `supabase.auth.signInWithPassword({ email, password })`
- `registerSubmit({ email, password, confirm_password, nickname })`
  - 校验 `password === confirm_password`
  - 调用 `supabase.auth.signUp({ email, password, options:{ data:{ nickname } } })`
  - 成功后立即调用 `supabase.auth.signOut()` 强制登出，防止自动登录
  - 显示“请查收邮箱完成验证”，提供“返回登录”按钮
- `onAuthStateChange(event, session)`
  - `SIGNED_IN`：保存本地用户信息 → 调用 `linkController.initSyncAfterLogin()` → `redirect: dashboard.html`
  - `SIGNED_OUT`：清理本地状态 → `redirect: login.html`
- `onAuthSuccess(user)`
  - 构造 `localUser`（包含 `id/email/nickname/avatar`）并持久化

## 跳转与触发时机
- 登录成功：`linkController.initSyncAfterLogin()` 在 `SIGNED_IN` 事件中触发
- `dashboard.html` 初始化：如有 Session，再次触发同步以确保一致性

## OAuth（Google）
- 行为：`supabase.auth.signInWithOAuth({ provider: 'google' })`
- 未配置：按钮禁用并提示“暂不可用”（UI 层）

## UI 状态
- 按钮文案：
  - 登录：`登录` → `登录中...`（loading）
  - 注册：`立即注册` → `注册中...`（loading）
- 错误提示：
  - 登录：邮箱/密码必填 → “请输入邮箱和密码”
  - 注册：必填/确认密码一致 → “请填写完整并确认密码”；不一致 → “两次输入的密码不一致”
- 成功提示：
  - 注册成功：显示提示卡片“请检查邮箱并点击验证链接完成激活”，并提供“返回登录”按钮

## 安全与环境
- SDK 初始化：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`
- Edge Functions：如需调用统一使用 `supabase.functions.invoke(name, { body })`
- RLS 与 Authorization：遵循项目规则，前端仅使用 `anon` key

