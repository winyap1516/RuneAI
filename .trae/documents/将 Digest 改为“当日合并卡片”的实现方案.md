## 目标

* 生成当日合并 Digest：一次点击仅生成/更新当天的一条合并卡片（merged=true），包含所有启用订阅的条目（entries）。

* 保持现有 localStorage 键不变（`rune_subscriptions`、`rune_digests`）；UI 更友好、下载导出为单一 JSON。

## 数据结构

* 单条当日合并对象（示例）：

```
{
  id: "digest_20251126_xxxx",
  date: "2025-11-26",
  merged: true,
  title: "AI Digest · 2025-11-26",
  siteCount: <entries.length>,
  entries: [ { subscriptionId, url, title, summary, highlights, raw } ],
  created_at: <ts>,
  updated_at: <ts?>
}
```

* 统一 URL 比较：使用 `normalizeUrl(url)` 存取、合并与去重（防止 `https/http`、尾斜杠差异导致重复）。

## 生成流程

### 手动生成（dashboard.js）

* 在 `renderDigestView()` 的“生成当日简报”按钮处理函数替换为：

  * 读取启用订阅列表；若下拉选择了某订阅，仅处理该订阅；否则处理全部启用订阅。

  * 遍历订阅：对每个订阅调用 `tryFetchRealSite(url)`（若可用）→ 回退 `mockFetchSiteContent(url)`；再调用 `mockAIFromUrl(url)`；汇总到 `entries`。

  * 以 `dateStr = YYYY-MM-DD` 检查 `rune_digests`：

    * 若当天已存在 `merged===true` 对象，则将新 `entries` 合并（按规范化 URL 去重），更新 `siteCount` 和 `updated_at`。

    * 否则创建新的合并对象并 `push`。

  * 保存后调用现有 `render()` 或 `renderDigestList()` 刷新。

* 单次成功提示显示生成条目数：例如“已生成 N 条日报（合并）”。

### Scheduler（main.js）

* 定时任务不再为订阅各自 `push` 独立 digest；改为：

  * 每轮收集符合频率条件的订阅，批量生成 `entries`，合并到当天 `merged` 对象（与手动逻辑一致）。

  * 或者：在现有 `processSubscription(sub)` 完成后，将结果 `entries` 写入/合并到当天 `merged` 对象，而不是 `push` 独立卡片。

## UI 渲染

### Digest 列表（dashboard.js）

* 列表仅展示合并对象（或优先展示 `merged` 对象）：

  * 卡片头部：`title` + `date`；右上角显示站点数 `siteCount sites`。

  * 预览区域：按 `entries` 渲染多个 site-block（每块显示 `title + summary`，tags 高亮）。

  * 操作区：`下载 JSON`（导出整个合并对象）、`删除`（删除当日合并对象，不影响订阅）。

* 详情面板：

  * 展开显示每个站点完整摘要与 tags；`Raw Data` 默认折叠；点击“展开 Raw JSON”显示整个合并对象的 `raw`（包含每条目的原始抓取/AI 数据）。

## 规范化与去重

* 写入/查找/合并均对 URL 执行 `normalizeUrl(...)`；在合并时用 `Set(existingUrls)` 去重。

* Digest 下拉过滤（已存在）：生成时若选择了某订阅，仅生成该订阅对应条目；选择“全部订阅”则处理所有。

## 兼容与迁移

* 保留旧的单订阅 digest（非 merged）读取逻辑，但列表优先显示合并对象；必要时可隐藏旧模式或在首次合并后停止生成分散对象。

* 删除操作仅删除合并对象，不触及订阅数据。

## 代码改动点（文件/函数）

* `js/features/dashboard.js`

  * 替换“生成当日简报”按钮处理为 `generateTodayMergedDigest(selectedSubId)` 风格逻辑；完成收集、合并保存与 UI 刷新。

  * 更新列表与详情渲染以支持 `entries` 多块预览与折叠 Raw。

* `js/main.js`

  * 更新 Scheduler：遍历订阅批量生成并合并至当天 `merged` 对象；或在 `processSubscription(sub)` 中把结果写入当日合并对象。

* `mockFunctions.js`

  * 无需改动接口；直接复用 `mockFetchSiteContent` 与 `mockAIFromUrl`。

## 验证用例

* 订阅 2 个站点，点击“生成当日简报”→ Digest 列表仅新增 1 张合并卡片，`siteCount=2`，预览显示 2 个站点摘要。

* 再次点击（或 Scheduler 触发）→ 合并卡片更新，追加新 entries（不重复 URL）。

* 选择下拉某订阅生成→ 合并卡片只包含该订阅条目；再次选择“全部订阅”合并补齐。

* 下载 JSON 导出为单一对象（含 `entries` 数组）。

* 删除合并卡片→ 仅移除当日合并对象，订阅不受影响。

## 风险与回退

* 如果当天同时存在旧的分散卡片与新的合并对象，列表显示策略需明确（推荐仅显示 merged 对象）。

* 若网络抓取失败，回退 mock；条目以“抓取失败”摘要占位并保留 `raw.error`。

## 下一步

* 我将按以上方案修改 `dashboard.js` 与 `main.js`，并补充渲染与下载逻辑，所有代码使用中文注释，确保刷新与交互稳定。是否确认执行？

