# Phase 5 审计报告（自动合并与删除安全策略）

## 改动概览
- 引入字段级 LWW 自动合并（无阻断 UI）。
- Tombstone 删除：deleted=true + deleted_at，并写入 deletion_backups。
- 冲突备份：当服务器字段更新晚于本地字段时，写入 conflict_backups（仅审计）。
- 客户端：SyncAgent 自动发送 per-field 时间戳，接收 merged_record 后本地落盘；有冲突则显示非阻断 Toast。

## 数据库迁移
- 文件：`supabase/migrations/phase5/001_field_lww_tombstone.sql`
- 变更：主表新增 `data`/`field_timestamps`/`server_applied_ts`/`deleted`/`deleted_at`。
- 新表：`conflict_backups`、`deletion_backups`。
- RPC：`apply_client_changes` 替换为字段级合并逻辑，返回 `{ applied, conflicts_logged }`。

## 客户端改动
- `js/sync/changeLog.js`：写入 `field_timestamps`。
- `js/sync/syncAgent.js`：发送 `field_timestamps`；写入 `merged_record` 到本地；非阻断 Toast。
- `js/utils/ui-helpers.js`：新增 `showToast()`。
- `js/storage/db.js`：新增本地 `conflict_backups` / `deletion_backups` store。

## 验证步骤（摘要）
1. 基础同步：更新 title → push → server 更新 → pull → 本地一致。
2. 字段级合并：A 改 title；B 改 tags → 合并后同时存在，`conflicts_logged=0`。
3. 同字段冲突：A 在 t1 改 title；B 在 t2 改 title → 以 t2 为准，`conflicts_logged=1`，Toast 提示。
4. 删除语义：A 删除，B 在删除前更新字段；若 `delete_ts > any field_ts` → 删除生效并写入 `deletion_backups`；否则记录冲突备份。

## 回滚步骤
- Git：`git revert <merge-commit>`。
- DB：执行回滚迁移（谨慎删除备份表前请导出数据）。

## 影响范围
- 写路径与合并策略（website/subscription/digest 后续逐步扩展）。
- 删除后的恢复依赖备份表；清理任务需在 Cron/Edge Function 中实现。

**日志位置**：`devops/audit/phase5/logs/`（执行记录与示例响应）。
