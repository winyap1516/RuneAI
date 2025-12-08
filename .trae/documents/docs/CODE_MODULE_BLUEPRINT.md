# 项目代码模块清单 (Code Module Blueprint)

## 新增模块（2025-12-08）

- 模块名称：`uiService`
  - 目录：`src/js/services/uiService.js`
  - 职责：提供 UI 相关的通用服务，如打开 Add Link 模态框。
  - 输入/输出：`openAddLinkModal()` -> void
  - 依赖关系：`utils/dom.js` (openModal)
  - 交互：由 `linksView.js` (顶部及卡片 Add Link 按钮) 调用。
  - 五行：Water（集成/交互）
  - 角色：Support（佐）

- 模块名称：`linksView`
  - 目录：`src/js/views/linksView.js`
  - 职责：渲染链接卡片列表、筛选与搜索；在非 `All Links` 分类末尾渲染“+”选择卡片；绑定选择已有链接加入当前分类的弹窗（`selectLinkModal`）。
  - 输入/输出：
    - 输入：`controllers.linkController`、`templates.createCard`、`utils.dom`
    - 输出：DOM 更新（`#cardsContainer`、`.rune-card-add` 交互）、筛选视图状态
  - 关键函数：
    - `filterCardsByCategory(name)`：根据分类渲染并在末尾插入“+”卡片
    - `bindSelectLinkModalEvents()`：绑定 `.rune-card-add` 点击 → 打开 `#selectLinkModal` 并渲染可选链接列表
    - `bindModalEvents()`：绑定 `#addLinkBtn` 与 `#addLinkBtnHeader` → 复用 `uiService.openAddLinkModal`
  - 依赖关系：`controllers/linkController`、`services/uiService`、`utils/dom`
  - 交互：由 `features/dashboard.js` 初始化调用 `initLinksView()`；监听 `storageAdapter` 事件刷新视图
  - 五行：Wood（业务/功能增长）
  - 角色：Envoy（使）

- 模块名称：`dashboard_init`
  - 目录：`src/js/dashboard_init.js`
  - 职责：Dashboard 入口初始化与访问控制；检查 Session（或 Dev/Mock 兜底），未登录统一重定向 `login.html`；准备上下文后调用 `features/dashboard.initDashboard()`。
  - 输入/输出：
    - 输入：`supabase.auth.getSession()`、`storageAdapter.getUser()`
    - 输出：重定向、用户状态恢复、触发 `linkController.initSyncAfterLogin()` 或 `mockApi.loadBundle()`
  - 依赖关系：`services/supabaseClient`、`controllers/linkController`、`features/auth_ui`、`features/dashboard`、`services/apiRouter`
  - 交互：页面 `dashboard.html` 加载即执行自调用初始化函数
  - 五行：Earth（基础设施/初始化）
  - 角色：Minister（臣）

- 模块名称：`dashboard.html`（视图模板变更）
  - 目录：`public/dashboard.html`
  - 职责：在 All Links 区域用新按钮 `#addLinkBtnHeader` 替换标题；保留旧按钮 `#addLinkBtn` 并默认添加 `global-add-link--hidden` 便于回滚；新增 `#selectLinkModal` 弹窗占位。
  - 输入/输出：
    - 输入：样式类（Tailwind）、视图渲染脚本 `linksView.js`
    - 输出：可访问的 Add Link 按钮（`aria-label="Add Link"`）、按需隐藏旧按钮
  - 依赖关系：`services/uiService`（打开 Add Link 模态）；`views/linksView`（绑定事件）
  - 交互：按钮点击 → 打开 Add Link 模态；“+”卡片点击 → 打开选择已有链接弹窗
  - 五行：Wood（前端视图/功能展示）
  - 角色：Envoy（使）

### 变更摘要（2025-12-08）
- 将全局 Add Link 按钮移至 All Links 区域并替代标题（响应式与无障碍）
- 在分类末尾新增“+”卡片，点击后打开 `selectLinkModal` 以选择已有链接加入当前分类
- 抽取 `openAddLinkModal` 到 `uiService` 统一复用
- 修复模板字符串转义导致的插值失败（`linksView.js:862-866`）

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
  - 依赖关系：`plans`、`stripe`。
  - 交互：前端购买按钮触发。

- 模块名称：`stripe-webhook`
  - 目录：`supabase/functions/stripe-webhook/index.ts`
  - 职责：处理 Stripe 支付成功事件，发放额度。
  - 输入/输出：Stripe Event → 更新 `user_quotas` / `purchases`。
  - 依赖关系：`stripe_events`、`user_quotas`、`purchases`。
  - 交互：Stripe 服务端回调。

- 模块名称：`billing_service`
  - 目录：`src/js/services/billing_service.js`
  - 职责：前端计费相关 API 封装（获取额度、发起支付）。
  - 输入/输出：`getQuota()`, `buyPlan()`。
  - 依赖关系：`supabaseClient`。
  - 交互：`account_settings.js` 调用。

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
