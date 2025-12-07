## 目标与范围
- 在本地开发阶段实现“网站订阅 + 定期抓取生成日报”的完整链路（纯前端、localStorage 持久化、mock 抓取与摘要）。
- 分支：`feature/subscriptions`；提交 PR 时列出改动点、数据结构与验证结果。

## 数据结构（localStorage）
- `rune_subscriptions`：订阅数组（字段与示例与需求一致）。
- `rune_digests`：日报数组（字段与示例与需求一致）。
- 现有 `rune_cards` 不改动，仅在 UI 中引用卡片 URL/Title 提示。

## 端到端流程
1. 用户在卡片上点击 `Subscribe` → 写入一条 `subscription`（默认频率 `daily`，`enabled=true`，`lastChecked=Date.now()`）。
2. 前端 Scheduler（Dev 模式）周期性检查订阅，按频率触发 `processSubscription(sub)`。
3. `processSubscription`：尝试抓取 → 生成摘要 → 写入 `rune_digests`（一条 digest），并更新 `sub.lastChecked`；UI Toast 提示“已生成 X 条日报”。
4. 侧栏 `Subscriptions` 管理：列出订阅、手动 `Generate Now`、编辑频率/启用、取消订阅；Digest 查看器按日期和订阅筛选，支持下载 JSON 与标记已读。

## 前端改造
### 卡片层（`features/dashboard.js` 或新建 `features/subscriptions.js`）
- 在卡片模板增加 `Subscribe` 按钮：
  - 未订阅 → `Subscribe`；已订阅 → `Subscribed`（实心图标+下拉菜单：`Unsubscribe`、`Settings`）。
  - 事件委托：根据卡片 `data-card-id`、`url` 读写 `rune_subscriptions`。
  - 订阅确认弹窗（复用现有 `openConfirm`）：默认 `frequency='daily'`，允许后续在 Settings 中修改。
- 订阅状态渲染：首屏渲染时，根据 `rune_subscriptions` 高亮已订阅卡片，按钮切换。

### 侧栏 / 管理面板（`dashboard.html` + `dashboard.js`）
- 新增分组 `Subscriptions`：列表项展示 `title/frequency/lastChecked`，并提供操作按钮：
  - `Generate Now`：立即调用 `processSubscription(sub)` 并显示 Toast。
  - `Edit`：打开设置模态（频率选择：`daily`/`every_6h`/`hourly` + Dev 快速周期，如 `every_1m`）。
  - `Unsubscribe`：删除或 `enabled=false`（按需选择，UI 标注）。
- Digest 查看器：
  - 新建 `DigestModal` 或页面区域（保持与当前视图切换方式一致），支持：
    - 筛选：日期（`YYYY-MM-DD`）与订阅（下拉）
    - 展示：`title/summary/highlights`，可展开原始数据 `raw`
    - 操作：`下载 JSON`（`Blob`）、`标记已读`（本地状态字段如 `read=true`）

## Mock 抓取与摘要（`mockFunctions.js`）
- 新增 `mockFetchSiteContent(url)`：返回 `{ content, timestamp }`（示例文本拼接当前 ISO 时间）。
- 生成摘要：优先复用 `mockAIFromUrl(url)` 返回 `{title, description, category, tags}`；
  - `highlights`：可直接使用 `tags` 或在前端从 `description` 分句提取简单要点（逗号/句号分隔，取前几句）。
- 抓取策略：
  - `tryFetchRealSite(url)`：使用 `fetch(url)`（可能被 CORS 拦截）；成功则取 `text()`；失败则回退 `mockFetchSiteContent(url)`。

## Scheduler（`js/main.js`）
- 启动条件：`import.meta.env.DEV` 为 `true`（仅 Dev 模式）。
- 定时器：`setInterval(checkAllSubscriptions, 60 * 1000)`；频率映射：
  - `daily → 24h`，`every_6h → 6h`，`hourly → 1h`；Dev 允许 `every_1m → 1min`。
- `checkAllSubscriptions()`：遍历 `rune_subscriptions`，判断 `Date.now() - lastChecked >= interval` 时触发 `processSubscription(sub)`。
- 执行锁：在 `sub.inProgress` 为 `true` 时跳过，`finally` 清理。
- `processSubscription(sub)`：
  - 抓取（真实/回退）→ 生成摘要 → 构造 `digest`：
    - `id: generateId()`、`subscriptionId: sub.id`、`url/title/date/summary/highlights/raw`（含 `site/ai` 或 `raw.error`）。
  - 写入 `rune_digests`；更新 `sub.lastChecked` 与 `inProgress`；Toast 提示。

## 错误与边界
- 抓取失败：写入失败 digest（`summary='抓取失败，使用本地摘要占位'`，`raw.error` 保存异常信息）。
- AI 返回缺字段：`title → url 或 sub.title`，`summary → site.content.slice(0,500)`；`highlights → []`。
- localStorage 写失败：`try/catch` 并在 UI 提示容量问题（不阻塞其他订阅）。

## API/Helper（前端）
- `loadSubscriptions()/saveSubscriptions()`、`loadDigests()/saveDigests()`（与现有存储工具一致）。
- `frequencyToMs(freq)`、`notifyUserDigest(digest)`（Toast/点提示）
- `generateDigestNow(subId)`（供侧栏按钮使用）

## UI 文案与注释
- 所有新增代码带中文注释；按钮/提示文案中文，国际化键可后续补充。

## 验收与测试
- 订阅：卡片点击后 `rune_subscriptions` 增加，侧栏可见，状态为 `enabled:true`。
- 手动生成：`Generate Now` 立即生成，Toast 提示，`rune_digests` 增加条目，Digest 查看器展示。
- 定时任务：在 Dev 缩短周期下自动生成；刷新后数据仍保留。
- 取消订阅：`Unsubscribe` 后不再处理该订阅。
- 异常：抓取失败写入 `raw.error`，不影响其他订阅。

## 提交 PR 清单
- 新/改文件：`features/subscriptions.js`（或在 `dashboard.js` 增量）、`mockFunctions.js`（新增函数）、`js/main.js`（Scheduler）、`dashboard.html`（侧栏与 Digest UI）。
- 数据结构与键名：`rune_subscriptions`、`rune_digests`、字段说明。
- 使用说明：如何在 Dev 模式验证定时、手动生成与查看下载。
- 截图/短动图：侧栏订阅管理、Digest 查看器、Toast 提示。