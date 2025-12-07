## 数据库与迁移

* 新增 `public.app_settings`、`public.user_quotas`、`public.plans`、`public.purchases`、`public.stripe_events`（幂等表）。

* 为 `user_quotas.user_id`、`purchases.user_id` 建索引；`plans.id` 为主键；`stripe_events.event_id` 唯一约束。

* 启用 RLS 并编写策略：

  * `user_quotas`：普通用户仅能 `SELECT` 自己；写入仅限 `role=admin` 或服务端。

  * `purchases`：普通用户可 `SELECT` 自己；用户可插入 `pending`（可选）；服务端插入 `succeeded/failed/refunded`。

  * `plans`：所有已登录用户可 `SELECT`；`admin` 可管理 `INSERT/UPDATE/DELETE`。

* 迁移脚本：位于 `supabase/migrations/2025xxxx_billing.sql`；包含初始 `plans` 种子数据（一次性与订阅示例）。

* 示例 SQL（含中文注释）将用于迁移文件：

  * 建表、索引、`alter table ... enable row level security`、`create policy ...`、`insert into plans(...)`。

## Edge Functions

* `supabase/functions/set-quota/index.ts`

  * 读取 `Authorization: Bearer <JWT>`，校验 `role='admin'`（从 JWT claims）。

  * `upsert` 到 `user_quotas`（`daily_limit`、`extra_credits`、`updated_at`）。

  * 返回 `{ ok: true }`；所有关键路径加中文注释与错误处理。

* `supabase/functions/create-checkout-session/index.ts`

  * 使用 `STRIPE_SECRET_KEY` 创建 Stripe Checkout Session；`metadata` 写入 `user_id` 与 `plan_id`。

  * `mode` 根据 `plans.recurring` 判定 `subscription` 或 `payment`，返回 `session.url`。

  * 读取计划数据并校验存在与可售状态。

* `supabase/functions/stripe-webhook/index.ts`

  * 验证 Stripe 签名；记录 `event_id` 入 `stripe_events` 防止重复（幂等）。

  * 处理 `checkout.session.completed` / `payment_intent.succeeded`：

    * 写入 `purchases(status='succeeded')`，保存 `stripe_payment_intent`、`amount`、`currency`、`plan_id`。

    * 根据 `plans.grant_amount` 增加用户额度：优先累加 `user_quotas.extra_credits`，若无记录则创建并保留默认 `daily_limit`。

  * 处理退款事件：`charge.refunded` → 扣回额度或标记为需人工处理（可配置策略）。

* 函数内部使用 Supabase 服务密钥；所有秘密仅存在于函数环境变量；前端永不持有。

## 前端流程与 UI

* 普通用户 `My Quota` 页面（`features/billing_ui.js` 或 `features/my_quota_ui.js`）：

  * 显示 `daily_limit`、`extra_credits`、`used_today`、`remaining`。

  * 当 `DAILY_LIMIT_REACHED`：展示购买入口 Modal；调用 `create-checkout-session` 后重定向至 Stripe。

* 管理员 `Admin Billing` 页面（`features/admin_billing_ui.js`）：

  * 用户搜索与编辑对话框：设置 `daily_limit` / `extra_credits` / 可选“重置今日使用”。

  * `Plans` 管理：增删改计划（受控，仅调用后台 API）。

  * `Purchases` 列表：查看状态与用户购买历史。

* 控制层与服务封装：

  * 在 `js/services/billing_service.js` 封装：

    * `getMyQuota()`、`createCheckoutSession(planId)`、`adminSetQuota(userId, dailyLimit, extraCredits)`。

  * 在 `js/controllers/billing_controller.js` 连接 UI 与服务。

* 配置：在 `js/services/config.js` 新增并校验：`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`STRIPE_PUBLIC_KEY`（仅前端）、前端站点 `FRONTEND_BASE_URL`。

## 限额校验与生成流程

* 在生成摘要函数（如 `supabase/functions/generate-digest/index.ts` 或现有服务）中：

  * 首先读取 `user_quotas`，若不存在则读取 `app_settings.default_daily_limit`。

  * 计算 `remaining = daily_limit + extra_credits - used_today`；不足则返回 `DAILY_LIMIT_REACHED`。

  * 成功生成后递增今日使用计数（沿用现有统计方案），如使用 `digests` 表按天统计。

## 安全与 RLS 要点

* 任何额度修改与财务写入仅可通过后端函数完成；前端只读并发起受控调用。

* RLS 中使用 JWT Claims 校验 `role='admin'`；服务端操作使用 Service Role 绕过 RLS。

* Stripe Secret 与 Webhook Secret 均仅在函数端；实现幂等：`stripe_events(event_id unique)`。

## 测试

* 单元测试（`tests/billing.unit.test.js`）：

  * Webhook 入账后：`purchases` 有成功记录、`user_quotas.extra_credits` 正确累加。

  * `generate-digest` 超限时返回 `DAILY_LIMIT_REACHED`。

* E2E（`tests/billing.e2e.test.js`）：

  * 模拟 Stripe Webhook（Test Key）：触发额度发放与界面剩余额度更新。

  * 管理员通过 `set-quota` 修改限额后，用户界面即时反映。

## 迁移与文档

* 迁移：在 `supabase/migrations` 新增单一迁移文件，包含建表、索引、RLS、策略与初始 `plans`。

* 文档更新（遵循项目规范）：

  * 更新 `/docs/README.md`（用户购买与额度说明）。

  * 更新 `/docs/ARCHITECTURE.md`（额度模块、付费数据流与 RLS 逻辑）。

  * 更新 `/docs/CHANGELOG.md`（新增付费与额度管理）。

  * 更新 `/docs/ENV.md`（新增环境变量）。

  * 更新《项目代码模块清单 (Code Module Blueprint).md》记录新模块与职责、输入输出、依赖。

## 环境变量

* 前端：`STRIPE_PUBLIC_KEY`、`FRONTEND_BASE_URL`（用于 `success_url/cancel_url`）。

* 后端函数：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`。

## 交付清单

* SQL 迁移文件（含中文注释与策略）。

* 三个 Edge Functions（TS，详细中文注释）：`set-quota`、`create-checkout-session`、`stripe-webhook`。

* 前端两个页面与服务封装：`My Quota`、`Admin Billing`、`billing_service.js`、`billing_controller.js`。

* 测试用例：单元 + E2E。

## 迭代顺序

* 先落库与 RLS → 管理员额度函数 → 前端 `Admin Billing` → Stripe Checkout 与 Webhook → `My Quota` 展示与购买入口 → 生成流程接入

