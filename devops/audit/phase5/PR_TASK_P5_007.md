# PR: 自动字段级合并 + Tombstone 删除（#P5-007）

## 变更摘要
- 实现字段级 **LWW** 自动合并（不弹窗，非阻断）。
- 删除采用 **Tombstone**（deleted/deleted_at），并写入 `deletion_backups`。
- 同字段竞争写入 **conflict_backups**（审计与恢复用）。
- 客户端同步代理发送 `field_timestamps` 并写入合并结果；冲突仅提示 Toast。

## 验证步骤
1. 基础：修改 title -> push -> server 更新 -> pull -> 本地一致。
2. 跨字段：A 改 title；B 改 tags -> 合并后两个字段都保留。
3. 同字段：A@t1 改 title；B@t2 改 title -> 以 t2 为准，记录 1 条 `conflict_backups`。
4. 删除：delete_ts > any field_ts -> 接受删除，`deletion_backups` 记录快照；否则拒绝删除并记录冲突。

## 回滚步骤
- `git revert <merge-commit>`。
- DB：可选执行 drop 备份表的迁移（先导出备份数据）。

## 测试步骤
- 本地运行：创建两端模拟（或两次顺序修改），观察返回的 `applied/merged_record` 与 `conflicts_logged`。
- 断网删除后上线，验证 Tombstone 行为与备份写入。
- DevTools Offline 下拉取，确认 UI 隐藏已删除项。

## 影响范围
- 写路径：`websites` 表字段映射（`data/field_timestamps` 同步旧列）。
- 删除与恢复：依赖 `deletion_backups`；后续需加管理端恢复、定时清理任务。

## 安全
- 未提交任何 `service_role` 密钥；RLS 与 RPC 均以 `auth.uid()` 约束。
