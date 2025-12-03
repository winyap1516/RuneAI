# 同步调试日志（Sync Debug Log）

本文件用于记录一次端到端同步过程的关键步骤与返回数据（示例）。

## 场景：本地更新 title → push → 合并 → pull
- Enqueue Change：`changeLog.addChange('website','update',id,{title:'New'},ts)`
- Push Request：`/functions/v1/sync-push`（batch size=1）
- Response：`applied[0].merged_record.data.title = 'New'`
- Local Apply：`applyMergedRecordLocally`
- Pull：`/functions/v1/sync-pull?since=...`（若有增量）

## 冲突场景：A@t1 vs B@t2（同字段）
- Server chooses t2；返回 `conflicts[]` 或记录 `conflicts_logged`
- 前端：若存在 `conflicts[]` → 弹窗；选择 `useServer` → 本地应用服务器快照

## 失败与重试
- 失败：指数退避；日志：`[Sync] Push failed ... backoff=...`
- 网络恢复：`window.online` 事件触发 `loop()`

> 将实际执行的请求与返回 JSON 片段粘贴于下方，便于审计回溯。
