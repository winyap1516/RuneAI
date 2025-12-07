# 项目代码模块清单 (Code Module Blueprint)

## 新增模块（2025-12-04）

- 模块名称：`send_queue`
  - 目录：`supabase/migrations/phase6/001_send_queue_logs.sql`
  - 职责：发送任务队列，控制状态、重试与退避。
  - 输入/输出：`digest_id` → 队列项；输出状态与 `next_try`。
  - 依赖关系：`digests` 表；由 `send-worker` 消费。
  - 交互：`enqueue-send` 入队；`send-worker` 处理。

- 模块名称：`send_logs`
  - 目录：`supabase/migrations/phase6/001_send_queue_logs.sql`
  - 职责：记录发送结果与响应，审计与可观测性。
  - 输入/输出：记录通道、目标、状态与 `response`。
  - 依赖关系：`digests` 表。
  - 交互：`send-worker` 写入；前端历史页读取。

- 模块名称：`generate-digest`
  - 目录：`supabase/functions/generate-digest/index.ts`
  - 职责：生成摘要（Mock/Prod AI），写入 `digests` 并必要时入队。
  - 输入/输出：`{ user_id, mode }` → `{ ok, digest, preview }`。
  - 依赖关系：`links`、`digests`、`subscriptions`。
  - 交互：前端 Digest 页点击触发；Scheduler 可调用。

- 模块名称：`list-digests`
  - 目录：`supabase/functions/list-digests/index.ts`
  - 职责：分页与日期筛选返回用户摘要列表。
  - 输入/输出：`{ page, page_size, date }` → `{ data, error }`。
  - 依赖关系：`digests` 表。
  - 交互：前端历史页调用。

- 模块名称：`enqueue-send`
  - 目录：`supabase/functions/enqueue-send/index.ts`
  - 职责：将指定摘要入队。
  - 输入/输出：`{ digest_id }` → `{ ok }`。
  - 依赖关系：`digests`、`send_queue`。
  - 交互：前端手动发送按钮触发；历史页重试触发。

- 模块名称：`send-worker`
  - 目录：`supabase/functions/send-worker/index.ts`
  - 职责：批处理队列，发送到 Telegram，写日志并更新状态。
  - 输入/输出：无输入；返回 `{ ok }`。
  - 依赖关系：`send_queue`、`digests`、`subscriptions`、`send_logs`。
  - 交互：由 Supabase Scheduler 每 1 分钟调用；开发环境可手动触发。

- 模块名称：`sendLogsView`
  - 目录：`js/views/sendLogsView.js`
  - 职责：展示发送日志并提供重试按钮。
  - 输入/输出：调用 `enqueue-send` 重试；展示 `send_logs`。
  - 依赖关系：`supabaseClient`、`send_logs`。
  - 交互：仪表盘中导航到历史页。

- 模块名称：订阅管理 UI 增强
  - 目录：`js/components/settings-panel.js`
  - 职责：管理频道选择与目标填写、退订与 consent 展示。
  - 输入/输出：更新 `subscriptions` 的 `channel` 与 `target_id`。
  - 依赖关系：`storageAdapter`、`subscriptions`。
  - 交互：Settings 面板中操作并即时保存。
## 新增模块（2025-12-06）

- 模块名称：`user_quotas`
  - 目录：`supabase/migrations/phase8/001_billing.sql`
  - 职责：用户每日限额与一次性额外额度。
  - 输入/输出：`user_id` → `daily_limit/extra_credits`。
  - 依赖关系：`auth.users`、`app_settings`。
  - 交互：前端读取；由 `set-quota` 与 `stripe-webhook` 写入。

- 模块名称：`plans`
  - 目录：`supabase/migrations/phase8/001_billing.sql`
  - 职责：售卖计划定义（授予次数、价格、订阅与一次性）。
  - 输入/输出：`id` → `grant_amount/stripe_price_id`。
  - 依赖关系：无（业务）。
  - 交互：前端 `My Quota` 展示与选择；`create-checkout-session` 使用。

- 模块名称：`purchases`
  - 目录：`supabase/migrations/phase8/001_billing.sql`
  - 职责：记录用户购买与状态变更。
  - 输入/输出：`user_id/plan_id/status/amount`。
  - 依赖关系：`plans`、`auth.users`。
  - 交互：Webhook 写入；管理员查看。

- 模块名称：`stripe_events`
  - 目录：`supabase/migrations/phase8/001_billing.sql`
  - 职责：Webhook 幂等事件记录。
  - 输入/输出：`event_id/type`。
  - 依赖关系：无。
  - 交互：`stripe-webhook` 使用。

- 模块名称：`set-quota`
  - 目录：`supabase/functions/set-quota/index.ts`
  - 职责：管理员设置用户每日与额外额度。
  - 输入/输出：`{ user_id, daily_limit, extra_credits }` → `{ ok }`。
  - 依赖关系：`user_quotas`。
  - 交互：`Admin Billing` 页面调用。

- 模块名称：`create-checkout-session`
  - 目录：`supabase/functions/create-checkout-session/index.ts`
  - 职责：创建 Stripe 结账会话。
  - 输入/输出：`{ plan_id }` → `{ url }`。
  - 依赖关系：`plans`、Stripe。
  - 交互：`My Quota` 购买入口调用。

- 模块名称：`stripe-webhook`
  - 目录：`supabase/functions/stripe-webhook/index.ts`
  - 职责：校验并处理支付成功与退款，发放或回退额度。
  - 输入/输出：Stripe 事件 → `{ ok }`；写入/更新 `purchases(user_id, plan_id, status, amount, stripe_event_id, stripe_session_id, stripe_payment_intent)` 与 `user_quotas`。
  - 依赖关系：`plans`、`purchases`、`user_quotas`、`stripe_events`。
  - 交互：由 Stripe 服务器端回调。

- 模块名称：`billing_service.js`
  - 目录：`js/services/billing_service.js`
  - 职责：前端封装额度读取、管理员设额、创建结账与计划查询。
  - 输入/输出：服务方法返回 JSON。
  - 依赖关系：`supabaseClient`、`user_quotas`、`plans`。
  - 交互：供 UI/Controller 调用。

- 模块名称：`billing_controller.js`
  - 目录：`js/controllers/billing_controller.js`
  - 职责：连接 UI 与服务，组织调用与错误处理。
  - 输入/输出：`loadQuota/openCheckout/adminUpdateQuota/getPlans`。
  - 依赖关系：`billing_service.js`。
  - 交互：被 `My Quota` 与 `Admin Billing` 使用。

- 模块名称：`My Quota`
  - 目录：`js/features/my_quota_ui.js`
  - 职责：展示用户额度与购买入口。
  - 输入/输出：渲染 DOM、跳转结账。
  - 依赖关系：`billing_controller.js`。
  - 交互：仪表盘中入口展示。

- 模块名称：`Admin Billing`
  - 目录：`js/features/admin_billing_ui.js`
  - 职责：管理员设置用户额度。
  - 输入/输出：提交设定并提示结果。
  - 依赖关系：`billing_controller.js`。
  - 交互：Admin 页面入口展示。
- 模块名称：`admin_audit_logs`
  - 目录：`supabase/migrations/phase8/003_audit_extend.sql`
  - 职责：记录管理员操作（如设置用户额度）。
  - 输入/输出：`{ admin_user_id, target_user_id, action, payload }`。
  - 依赖关系：`set-quota`。
  - 交互：管理员操作写入审计日志，供后续审计与告警。

## 变更模块（2025-12-06 — Auth 路由与安全修复）

- 模块名称：`supabaseClient`
  - 目录：`js/services/supabaseClient.js`
  - 职责更新：认证头生成改为 JWT-only；生产环境禁用任何 fallback；Dev 可通过 `window.__ALLOW_DEV_AUTH_FALLBACK__` 显式开启回退（localStorage/anon）。
  - 输入/输出：`getAuthHeaders()` 在无 JWT 且生产环境抛出 `JWT_REQUIRED`；常规返回 `Authorization: Bearer <JWT>`。
  - 依赖关系：`config`、`logger`。
  - 与其他模块交互：`callFunction/callRest` 依赖该认证头；服务端在无 JWT 时返回 401。

- 模块名称：`config`
  - 目录：`js/services/config.js`
  - 职责更新：`validate()` 的 `VITE_FRONTEND_BASE_URL` 改为条件校验；未设置时仅警告，不阻断应用启动。
  - 输入/输出：提供 `frontendBaseUrl` 给 OAuth/邮箱回跳使用。

- 模块名称：`auth_ui`
  - 目录：`js/features/auth_ui.js`
  - 职责更新：统一登出后跳转为 `login.html`；统一 Google OAuth 重定向为 `${config.frontendBaseUrl}/dashboard.html`；重发验证邮件严格使用 Base URL。
  - 与其他模块交互：触发 `linkController.initSyncAfterLogin()`；依赖 `supabaseClient` 与 `config`。

- 模块名称：`dashboard_init`
  - 目录：`js/dashboard_init.js`
  - 职责更新：未登录守卫统一跳转 `login.html`，与登出行为一致；日志明确。
