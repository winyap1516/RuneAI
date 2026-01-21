# RuneAI 系统架构蓝图 (Architecture Blueprint)

## 概览
- 目标：卡片管理（新增/编辑/删除）、AI 摘要生成、订阅追踪与日报；本地 IndexedDB 与云端 Supabase 双写与同步。
- 前端：控制器/视图/模板实现乐观更新与云端回补；云端不可用时不阻塞交互。
- 后端：Supabase Edge Functions（`super-endpoint`、`update-link`、`delete-link`、`sync-push`、`sync-pull`），RLS 与用户 JWT 授权。

## 系统上下文与数据流
- Add Link
  - 本地立刻写入 Pending → UI 渲染；后台并发：
    - 云端写入（SDK，失败或0行受影响→回退 EdgeFn）
    - 调用 `super-endpoint` 生成元数据 → 前端 `updateLink` 写回（本地+云端），`ai_status=completed`
  - 参考：`src/js/controllers/linkController.js:238`
- Update Link
  - 本地更新 → 云端更新 `.eq('user_id',uid).eq('url',url)`；若受影响行数=0 → 回退 EdgeFn `update-link`
  - 参考：`src/js/controllers/linkController.js:385`
- Delete Link
  - 本地删除/级联 → 云端删除 `.eq('user_id',uid).eq('url',url)`；若0行 → 回退 EdgeFn `delete-link`
  - 参考：`src/js/controllers/linkController.js:455`
- AI 生成
  - `generateAI(id)` 将 `ai_status=pending` → 调 `super-endpoint` → 回写 `title/desc/tags/category/ai_status=completed` → 云端同步
  - 参考：`src/js/controllers/linkController.js:324`
- Sync
  - Push：批量应用客户端变更（RPC 幂等）
  - Pull：拉取 websites/subscriptions/digests/generation_logs 聚合

## 五行模块与君臣佐使
- 木（业务/增长）
  - `src/js/controllers/linkController.js`（君）新增/更新/删除、AI 触发、云端同步
  - `src/js/views/linksView.js`（佐）渲染、编辑/删除、分类与订阅按钮切换
  - `src/js/templates/card.js`（佐）卡片结构与 AI 状态 UI
- 火（性能/计算）
  - `supabase/functions/super-endpoint/index.ts` 调用 OpenAI，抓取清洗与回退
- 土（库/部署）
  - `src/js/storage/storageAdapter.js` IndexedDB 适配；本地变更日志
  - `supabase/functions/sync-push/index.ts`、`sync-pull/index.ts` 批量同步
- 金（安全/标准）
  - `src/js/services/supabaseClient.js` JWT/Authorization 头与 EdgeFn 调用策略
  - `src/js/services/config.js` 配置集中与校验
- 水（接口/管道）
  - `update-link`/`delete-link`/`super-endpoint`/`sync-*` Functions

## 授权与安全边界
- 前端仅 `anon key`；写操作必须带 `Authorization: Bearer <JWT>`。
- `links` 表约束：按 `user_id + url` 精确定位；RLS 启用。
- EdgeFn 环境：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`（后端）、`ENV`（可选）。
- 参考：`src/js/services/supabaseClient.js:114`（Auth 头）、`supabase/functions/update-link/index.ts:67`、`supabase/functions/delete-link/index.ts:44`

## UI 要点与源码引用
- AI 状态元素（精准局部刷新）
  - 模板数据标记：`src/js/templates/card.js:86`
  - 视图刷新逻辑：`src/js/views/linksView.js:172`
- favicon 多级回退（Google→DuckDuckGo→首字母）
  - `src/js/utils/ui-helpers.js:59`
- 订阅与按钮切换（Track/Generate）
  - 模板显示：`src/js/templates/card.js:117`
  - 局部切换：`src/js/views/linksView.js:196`

## 风险与缓解
- SDK 更新/删除 0 行受影响 → 强制回退 EdgeFn（已在控制器实现）
- Dev 环境与 Prod 行为差异 → 通过 Secrets 与 `ENV` 控制
- 日志规范 → 统一走 `src/js/services/logger.js`

## 信心等级
- 高（与当前源码与已部署函数一致）
