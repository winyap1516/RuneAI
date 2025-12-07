## 问题概述
- 刷新后按钮从蓝色“Subscribed”回退为灰色“Subscribe”，原因是按钮 `data-url` 与 `localStorage` 中订阅的 `url` 存在协议/尾斜杠/大小写差异，字符串直接比较导致不匹配。
- 部分视图切换或异步渲染后，没有在卡片完成注入后统一调用 `markSubscribedButtons()` 进行状态恢复。

## 修复方案
1. 统一 URL 规范化
- 在三处强制统一使用 `normalizeUrl(...)`：
  - 订阅写入：`handleSubscribe` 写入与查找前均对 `url` 规范化（js/features/dashboard.js:905-976）。
  - 按钮标记：`markSubscribedButtons()` 构建“已启用订阅 URL 集合”与按钮 `data-url` 比对时统一规范化（js/features/dashboard.js:160-171）。
  - 卡片模板：`createCard()` 生成按钮的 `data-url` 时使用规范化后的 URL，避免渲染期就产生差异（js/features/dashboard.js:60-91）。

2. 保证渲染后立即同步按钮状态
- 在所有可能注入卡片的时机调用 `markSubscribedButtons()`：
  - 首屏/返回主视图：`renderDefaultMain()` 完成后调用（js/features/dashboard.js:389-396）。
  - 批量注入示例或缓存卡片：`seedDemoCards()` 完成后调用（js/features/dashboard.js:920-925）。
  - 新增单卡片：保存后、插入 DOM 后调用（js/features/dashboard.js:781-783）。
- 可选增强：为 `cardsContainer` 添加 `MutationObserver`，在检测到新节点插入时触发一次 `markSubscribedButtons()`，确保未来异步渲染路径也能同步按钮状态。

3. 按钮切换更顺滑
- 事件绑定仅用 `click`，避免与 `pointerdown` 叠加造成闪烁。
- 在 `handleSubscribe` 内加入短暂 `setLoading(btn, true, '处理中…')`，写入后立即 `setLoading(btn, false)` 并更新文案/样式。
- 使用 `e.stopImmediatePropagation()` 防止同源事件重复触发。

4. Digest 保持依赖订阅数据
- Digest 仍从 `localStorage:rune_subscriptions` 读取；移除侧栏不影响生成逻辑。
- 如有使用订阅 URL 过滤/展示，统一使用 `normalizeUrl` 比较，保证一致性。

## 变更点清单
- 更新 `handleSubscribe`：规范化 URL、加入 loading、只绑定 `click`、立即更新文案/样式（js/features/dashboard.js:905-976）。
- 更新 `markSubscribedButtons`：订阅集合与按钮 URL 都用规范化进行比对（js/features/dashboard.js:160-171）。
- 确认 `createCard` 的 `data-url` 使用规范化值（js/features/dashboard.js:60-91）。
- 确认所有渲染路径后调用 `markSubscribedButtons()`（js/features/dashboard.js:389-396、920-925、781-783）。
- 可选：为 `cardsContainer` 添加一次性 `MutationObserver`，监听子节点变更后触发按钮状态同步。

## 验证用例
- 添加订阅：`https://openai.com/` → 刷新后按钮仍为蓝色。
- 添加订阅：`http://openai.com` → 刷新后与 `https://openai.com/` 卡片都标记为蓝色。
- 移除订阅：再次点击按钮 → 按钮变灰；刷新后仍保持灰色。
- 多来源渲染：本地缓存/示例/云端拉取均能在渲染结束后正确标记按钮。

## 风险与回退
- 规范化策略过于激进可能影响带路径的订阅区分；当前策略保持协议与主机规范化且保留路径与查询（按你现有实现）。
- 若出现意外匹配，可临时关闭 `MutationObserver`，仅保留显式调用 `markSubscribedButtons()`。

## 需要确认
- 是否需要开启 `MutationObserver` 作为兜底（默认不开启，按需启用）。
- 订阅 URL 是否需要严格区分不同路径（当前保留路径不合并）。