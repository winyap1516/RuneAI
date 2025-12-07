# RuneAI

一个用于收藏网页跟AI小助理网页

## 项目简介

RuneAI 是一个现代化的网页收藏和AI助理工具，帮助用户高效管理和利用网络资源。

## 主要功能

- 🔖 智能网页收藏管理
- 🤖 AI驱动的内容分析和推荐
- 📱 响应式设计，支持多设备
- ⚡ 高性能虚拟滚动技术
- 🔍 智能搜索和分类

## 技术栈

- 前端：HTML5, CSS3, JavaScript (ES6+)
- 构建工具：现代构建系统
- 部署：GitHub Pages

## 最近更新（Phase 5）

本项目已完成 Phase 5 的基础体验整合与重构：入口 → 登录/注册（独立页）→ SDK Auth → Sync → Dashboard。

### 用户体验流（入口 → Auth Flow → Sync Flow）
- 首页入口：`index.html` 提供“登录 / 注册”按钮，跳转到 `login.html`。
- 登录流程：`login.html` 负责用户认证，支持 Google 登录（UI 预留）；登录成功后自动跳转 `dashboard.html`。
- 注册流程：`register.html` 负责新用户注册，注册后引导用户验证邮箱或登录。
- 访问控制：`dashboard.html` 加载时强制检查 Session，未登录自动重定向至 `login.html`。
- 自动同步：登录成功或 Dashboard 初始化时，调用 `linkController.initSyncAfterLogin()`，触发本地→云端迁移与同步。

### 技术整合
- Supabase SDK：`src/js/services/supabaseClient.js` 统一初始化与会话获取。
- Auth 逻辑重构：`src/js/features/auth_ui.js` 支持 `mode` 参数（login/register/global），实现逻辑复用与分离。
- 页面初始化：`src/js/dashboard_init.js` 接管 Dashboard 的 Session 检查与初始化逻辑。
- 云端操作迁移：所有数据操作已迁移至 SDK 直接调用（links 表与 Edge Function）。
- 组件化开发：
  - **Welcome Card**: 独立组件 (`src/js/components/user-welcome-card.js`)，负责欢迎与统计展示。
  - **RuneSpace**: Dashboard 顶部专属区域 (`#runeSpace`)，承载 Welcome Card，与 All Links 列表分离。
  - 原型预览：访问 `/prototypes/welcome_page.html` 可独立调试该组件。

### 账户恢复流程（Account Recovery）
- 恢复入口：未能使用社媒登录时，点击登录页底部灰色小链接或访问 `account-recovery.html`。
- 请求恢复：输入绑定的恢复邮箱后，系统创建一次性 `recovery_token`（有效期 1 小时），发送邮件链接。
- 确认恢复：点击邮件链接后，边缘函数生成二级 `set_password_token`（有效期 15 分钟），并 302 跳转至 `set-password.html?token=...`。
- 设置密码：在 `set-password.html` 输入并确认新密码（≥8 位，含字母与数字），成功后可使用邮箱+密码登录，且保留社媒登录绑定。
- 安全文案：页面始终使用模糊提示，不泄露邮箱是否存在；令牌均一次性使用并过期回收。

Edge Functions（后端）：
- `supabase/functions/request-recovery`：创建恢复令牌、速率限制（同 IP 15 分钟 ≥5 次 → 429）、发送邮件（开发返回 `preview_link`）。
- `supabase/functions/confirm-recovery`：校验并标记 `recovery_token` 已用，生成 `set_password_token`，重定向到前端设置密码页。
- `supabase/functions/set-password`：校验二级令牌并为既有 `user_id` 创建密码凭证，写入审计。

前端页面：
- `login.html`：OAuth-first 布局，Google 登录为主按钮；仅在社媒登录失败时显示灰色“账号恢复”入口。
- `account-recovery.html`：独立恢复页，输入恢复邮箱并提交；开发模式显示 `preview_link` 便于联调。
- `set-password.html`：设置密码页面，校验强密码规则，提交后提示成功并跳转登录。
- `reset-password.html`：忘记密码重置页（Supabase 邮件链接回跳），基于临时 Session 更新密码。

环境变量（生产/CI 必配）：
- `EMAIL_PROVIDER`（sendgrid | mailgun）
- `EMAIL_API_KEY`
- `EMAIL_FROM`
- `SUPABASE_URL`（Edge Functions）
- `SUPABASE_SERVICE_ROLE_KEY`（仅后端，不可暴露给前端）
- `FRONTEND_BASE_URL`（恢复重定向与回跳）

开发模式说明：
- 开发环境无需真实发信，`request-recovery` 返回 `preview_link` 用于端到端联调；相关测试覆盖令牌生命周期与速率限制。

## 手动测试步骤
1. 启动开发服务器：`npm run dev`，打开 `http://localhost:5173`。
2. 打开首页（Landing）：点击“登录 / 注册”进入 `login.html`。
3. 登录：优先点击 Google 登录；如失败，底部会出现“需要帮助登录？账号恢复”灰色入口。
4. 恢复流程：点击入口或访问 `account-recovery.html`，输入恢复邮箱提交 → 在开发环境查看 `preview_link` → 打开恢复链接后跳转 `set-password.html` → 设置新密码。
4. 注册：点击“注册一个” → 进入 `register.html` → 注册成功 → 提示验证或跳转。
5. 访问控制：手动登出 → 访问 `dashboard.html` → 应自动跳回 `login.html`。

## 开源协议

MIT License
## 计费与用户额度（Phase 8）
- 新增 `plans/purchases/user_quotas/app_settings/stripe_events` 表与 RLS 策略
- Edge Functions：`set-quota`（管理员设额）、`create-checkout-session`（Stripe 结账）、`stripe-webhook`（幂等入账与退款标记）
- 生成流程接入限额（并发安全事务函数 `generate_digest_with_quota`）
- 前端页面：`My Quota` 与 `Admin Billing`，服务封装与控制器

### 管理员角色配置（Supabase）
- 在 Supabase 控制台将管理员用户的 `app_metadata.role` 或 `user_metadata.role` 设为 `admin`
- RLS 使用 `current_setting('jwt.claims.role', true) = 'admin'` 校验权限

### 环境变量（前端/后端）
- 前端：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_FRONTEND_BASE_URL`、`VITE_STRIPE_PUBLIC_KEY`
- 后端：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`
- 请在开发/测试/生产环境分别配置 key，避免在 dev 使用生产密钥
