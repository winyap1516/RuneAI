## 项目现状速览

* IndexedDB 封装与分页：`js/storage/db.js` 已实现 `websites/digests/subscriptions` CRUD 与分页。

* 存储适配层：`js/storage/storageAdapter.js` 提供 `getLinksPage/addLink/updateLink/deleteLink` 等接口。

* 控制器与视图：`js/controllers/linkController.js`、`js/features/dashboard.js` 负责分页加载与渲染；`js/views/*` 承载 UI。

* Supabase：`supabase/functions/*` 已有部分 Edge Functions（新增、更新、删除）；`js/services/ai.js`/`js/controllers/linkController.js` 读取 `VITE_SUPABASE_*` 并调用 Supabase。

* 认证 UI/逻辑：存在入口与说明但未形成统一模块；未检测到 `rune.sync` 模块与本地 change-log。

## 技术选型与配置

* 使用 Supabase（Auth + Postgres + Storage + Realtime + RLS）。

* 环境变量：前端保留 `VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY`；服务端使用 Service Role（仅本地/部署环境变量，绝不入库）。

* 新增前端客户端封装：`js/services/supabaseClient.js` 统一初始化与 token 管理。

## 数据库 Schema 与 RLS（PostgreSQL）

* 创建表：`users/websites/subscriptions/digests/generation_logs/client_changes`，字段与用户给出的模型一致。

* 索引：`created_at/updated_at`、`websites(url,user_id)`、`client_changes(user_id,client_ts)`。

* RLS：所有资源表启用 `user_id = auth.uid()`；开放 `users` 仅限本人行读取；`client_changes` 仅本人可读写。

* Migration 文件：`supabase/migrations/phase4/*.sql`，含表定义、索引、RLS policies。

## API 端点（PostgREST + Edge Functions）

* Links：

  * `GET /api/v1/links?page=&size=` 映射 PostgREST 选择与分页（服务端计算 total/hasMore）。

  * `POST/PATCH/DELETE /api/v1/links/:id`：走 PostgREST 或保留 Edge Functions（与现有 `update-link/delete-link` 兼容）。

* Subscriptions/Digests：同 Links 结构（REST + RLS）。

* Sync：

  * `POST /api/v1/sync/push`（Edge Function `supabase/functions/sync-push`）：批量应用 `client_changes`，返回 `{applied, conflicts}`。

  * `GET /api/v1/sync/pull?since=`（Edge Function `supabase/functions/sync-pull`）：返回指定时间之后的变更。

  * 幂等要求：`/sync/push` 以 `client_change_id` 做唯一去重（UNIQUE 索引或 `INSERT ... ON CONFLICT DO NOTHING`），同一变更重复推送只应用一次并返回既有结果。

* 安全：所有请求携带 JWT；PostgREST 走 `apikey + Authorization: Bearer`。

## 客户端 Sync Agent（Local-first + Change-log）

* 目录与模块：

  * `js/sync/changeLog.js`：本地 change-log（IndexedDB 新 store `client_changes_local`），写入 `{id, resource_type, op, payload, client_ts, base_server_ts}`。

  * `js/sync/syncAgent.js`：`enqueueChange/syncLoop/pullChanges/applyServerChanges`，含退避重试与网络恢复监听。

  * `js/sync/conflict.js`：最小化冲突处理策略与 UI 触达（弹窗/提示）。

* 集成点：

  * 在 `storageAdapter.addLink/updateLink/deleteLink` 内部调用 `enqueueChange()`（不阻塞 UI）。

  * `features/dashboard.js` 启动 `syncLoop()`（前台→后台切换、在线状态变化立即触发）。

* 调度策略：

  * 间隔 5–30s；指数退避；上限 N 次后标记错误并提示。

  * Push 包含 `client_change.id/client_ts/device_id`，服务端去重（满足幂等）。

## 冲突检测与合并策略

* 基线：服务端资源维护 `updated_at`；客户端变更携带 `client_ts` 与 `base_server_ts`。

* 规则：`base_server_ts >= current updated_at` 时应用；否则标记冲突。

* 简单字段：采用字段级 LWW（以服务端 or 最新时间为准）或提示人工合并；复杂结构（digests/entries）尽量追加写。

* 记录：生成 `sync_logs/generation_logs` 以便审计与回溯。

## 数据迁移（IndexedDB → Cloud）

* 新模块：`js/sync/migrate.js`。

* 流程：

  * 扫描本地 `websites/subscriptions/digests/generation_logs`；将每条记录转为 `client_change(op=create)`。

  * 推送至 `/sync/push`，服务端若不存在则插入；返回 server id 映射用于本地回写。

  * 本地维护 `id_mapping`（`local_id → server_id`）并回写。

  * 首次登录后显示「迁移本地数据」提示；支持取消与进度展示。

## 安全 / 权限 / 配额

* RLS 全面启用；绝不在前端做角色判断。

* 环境变量与密钥：仅运行环境注入；仓库不存放任何密钥。

* 频率限制：在 Edge Functions 中做速率与批量大小限制；每日配额校验（摘要生成）。

## 测试 / CI / 监控

* 单元测试：`syncAgent/changeLog` 使用 `fake-indexeddb`；覆盖退避、离线重交与幂等推送。

* 集成测试：本地 Supabase + 测试数据，模拟 `sync push/pull`；验证 `client_change_id` 去重有效。

* E2E（Playwright）：离线新增 → 上线自动同步 → 另一设备可见；冲突用例。

* 监控：前端接入 Sentry；服务端记录基本日志与使用 Supabase Audit。

## 分阶段落地（A/B/C）

* Phase4-A（Auth + Links 最小闭环）：

  * 前端集成 Supabase Auth：`js/services/supabaseClient.js`、`js/features/auth_ui.js` 登录/注册/退出、token 持久化。

  * DB/RLS 基础表与策略落地；实现 `GET/POST/PATCH/DELETE /links` 与分页。

  * 登录后可手动触发 `migrateLocalToCloud()`（或提示弹窗）。

Phase4-B（Sync Agent + Migration）：

* 新建 `js/sync/*` 模块与本地 change-log；打通 `/sync/push` `/sync/pull`（满足幂等要求）。

* 迁移工具运行并验证；补充集成测试与 E2E 基本场景。

- Phase4-C（Production 强化）：

  * 配额、限流、告警与监控；部署参数与密钥管理完善。

## 具体代码改动清单（贴库）

* 新增：`js/services/supabaseClient.js`、`js/sync/changeLog.js`、`js/sync/syncAgent.js`、`js/sync/conflict.js`、`js/sync/migrate.js`。

* 修改：`js/storage/storageAdapter.js`（钩入 `enqueueChange`）、`js/controllers/linkController.js`（登录后触发迁移/同步）、`js/features/dashboard.js`（启动 `syncLoop`）。

* 服务端：`supabase/migrations/phase4/*.sql`、`supabase/functions/sync-push`（幂等 dedupe）、`supabase/functions/sync-pull`；保留现有 `update-link/delete-link` 并逐步统一。

## 验收标准

* 认证：用户可注册/登录；RLS 生效拦截越权访问。

* 同步：客户端可批量推送与拉取；断网恢复自动重试；`client_change_id` 去重验证通过。

* 迁移：IndexedDB → Cloud 一次性迁移成功且可重入（幂等）。

* 冲突：服务端返回冲突，客户端能最小化处理并记录。

* 测试：单元/集成/E2E 基本场景通过。

* 安全：仓库无密钥；端点均要求 JWT；RLS 有效。

