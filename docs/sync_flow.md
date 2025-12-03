# 同步流程说明（Sync Flow）

本文件基于 Blueprint 与现状代码，描述客户端与服务端的同步流程，便于复现与调试。

## 客户端（SyncAgent）
- 周期：每 10s 触发一次（失败指数退避）。
- Push：读取 `client_changes_local`，构造 batch，调用 `functions/v1/sync-push`。
- Pull：调用 `functions/v1/sync-pull?since=last_ts` 读取增量。
- 冲突：若返回 `conflicts[]`，弹出 `modal-conflict.js` 供用户选择；若返回 `conflicts_logged`，非阻断 Toast 提示。

## 请求/响应（简化）
- 请求：
```json
{
  "changes": [
    {
      "client_change_id": "uuid",
      "client_req_id": "uuid",
      "resource_type": "website",
      "op": "update",
      "payload": { "title": "..." },
      "field_timestamps": { "title": "2025-12-02T12:00:00Z" }
    }
  ]
}
```
- 响应：
```json
{
  "applied": [
    { "client_change_id": "...", "item_id": "...", "merged_record": { "data": {"title": "..."}, "deleted": false } }
  ],
  "conflicts": [],
  "conflicts_logged": 0
}
```

## 幂等与失败重试
- 幂等：以 `client_change_id/client_req_id` 去重，重复推送不重复应用。
- 失败：按 2s→4s→8s→16s→30s 退避；网络恢复事件立即重试。

## 调试建议
- 使用 `devtools` 观察网络请求。
- 查看 `IndexedDB` 的 `client_changes_local` 与本地存储映射。
