# CHANGELOG

## 2025-12-08 — UI 与初始化修订
- 视图：将全局 `Add Link` 按钮移至 **All Links** 区域并替代标题；旧按钮保留 DOM 并默认隐藏（`global-add-link--hidden`），可随时回滚。
- 交互：在非 `All Links` 分类末尾新增“+”卡片（`.rune-card-add`），点击打开 **选择已有链接** 弹窗（`#selectLinkModal`），支持搜索与加入当前分类。
- 服务：新增 `src/js/services/uiService.js`，抽取 `openAddLinkModal()` 统一模态框逻辑与焦点管理。
- 初始化：新增 `src/js/dashboard_init.js`，统一 Session 守卫与本地 Dev/Mock 注入，未登录统一跳转 `login.html`，初始化后调用 `features/dashboard.initDashboard()`。
- 修复：`linksView.js` 模板字符串转义导致插值失败，已更正（`src/js/views/linksView.js:862-866`）。

## 2025-12-04 — Web Digest MVP
- 新增数据库迁移：`send_queue`、`send_logs`（索引与 RLS）。
- 新增 Edge Functions：`generate-digest`、`list-digests`、`enqueue-send`、`send-worker`。
- 前端 Digest 页面增强：`Generate (Edge)`、摘要 `Preview`、`Send Now` 入队。
- 订阅管理 UI：频道选择与目标填写、consent 展示。
- 发送历史视图：展示 `send_logs` 并支持重试。
## 2025-12-06 — 计费与用户额度模块
- 新增数据库：`plans`、`purchases`、`user_quotas`、`app_settings`、`stripe_events`（索引与 RLS）。
- 新增 Edge Functions：`set-quota`、`create-checkout-session`、`stripe-webhook`。
- 更新 `generate-digest`：接入用户额度与一次性额外额度，达到每日限额返回 `DAILY_LIMIT_REACHED`。
- 前端新增：`billing_service.js`、`billing_controller.js`、`My Quota` 与 `Admin Billing` 页面。
- 文档更新：`ENV.md` 补充 Stripe 与前端基址；架构设计与模块清单待进一步完善。

## 2025-12-06 — Auth 路由与安全修复（P0）
- 修复：统一未登录访问守卫与登出后跳转为 `login.html`（`js/features/auth_ui.js:127-131`、`js/dashboard_init.js:16-19`）。
- 安全：生产环境禁用认证兜底（JWT-only），`getAuthHeaders()` 在无 JWT 时抛出 `JWT_REQUIRED`（`js/services/supabaseClient.js:93-143` 修订）。
- OAuth：统一 Google 登录成功后重定向为 `${config.frontendBaseUrl}/dashboard.html`（`js/features/auth_ui.js:269-270`、`js/views/authView.js:20`）。
- 配置：调整 `config.validate()` 的 Base URL 条件校验策略，未设置时警告不阻断（`js/services/config.js:17-21`）。
- 清理：删除重复的 `components/modal_login.html`，统一使用 `public/components/modal_login.html`。
