# 冲突解决说明（Conflict Resolution）

本阶段冲突处理遵循 Blueprint：
- UI：`js/components/modal-conflict.js` 必须提供 Server vs Local 对比与选择。
- 选择：Keep Local / Use Server。
- 行为：
  - Keep Local：重新构造 patch 并继续 push（强制覆盖策略由服务端判定）。
  - Use Server：将服务端快照应用到本地（`applyMergedRecordLocally`），队列继续。
- 审计：服务端记录 `conflict_backups`；客户端提示 Toast（非阻断）。

## 触发条件
- 服务端返回 `conflicts[]`；或客户端检测 `updated_at` 落后于服务端，需选择。

## 组件接口
```js
import { showConflictModal } from 'js/components/modal-conflict.js';
const choice = await showConflictModal({ local, server });
// 'keepLocal' | 'useServer' | 'cancel'
```

## 验收标准
- 可复现冲突并弹窗展示差异。
- 用户选择后同步继续，无阻断卡死。
- 相关审计记录可查询（服务端与本地）。
