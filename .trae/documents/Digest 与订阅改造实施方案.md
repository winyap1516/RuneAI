## 目标概述
- 订阅卡片不再显示抓取频率；频率统一迁移到“用户设定 → 订阅设定页面”集中管理。
- 将“生成一次”改为“立即生成简报（Single Digest）”，为该站点生成单站点 Digest。
- 在订阅卡片右上角三点菜单加入“取消订阅”，并弹出确认对话框；确认后退订并清理相关 Digest。
- Digest 卡片右下角补充“生成时间 + 查看摘要”入口，整体卡片视觉更紧凑，统一浅边框与轻阴影。

## 代码改动范围
- `js/features/dashboard.js`：订阅卡片模板、控件显示逻辑、事件委托、确认弹窗调用、Digest 卡片模板补充。
- `components/settings_panel.html`：新增“订阅设定”分区，订阅列表与频率选择 UI。
- `js/components/settings-panel.js`：实现打开设置、渲染订阅列表、频率变更持久化逻辑（当前为空，补全为组件交互脚本）。
- `languages/zh.json`：新增/更新文案键（如“立即生成简报”、“取消订阅”、“订阅设定”、“抓取频率”等）。
- （保留）`js/main.js`：本地 Scheduler 与 `frequencyToMs` 不变，确保新设定直接生效。

## 详细改动说明
### 订阅卡片（Subscriptions）
1. 移除卡片上的频率显示：
   - 从模板移除`.btn-frequency`与`.freq-label`，并在`markSubscribedButtons()`与`syncCardControlsVisibility()`中删除/关闭对应引用与显示逻辑。
2. 按钮文案改为“立即生成简报（Single Digest）”：
   - 将`.btn-generate-once`文案改为“立即生成简报（Single Digest）”；保留现有单站点合并当日 Digest 的写入逻辑（已实现于 ~1216 行）。
3. 取消订阅功能（三点菜单）：
   - 在右上角`rune-card-menu`新增菜单项“取消订阅”。
   - 点击后调用现有`openConfirm({...})`，文案：
     - 标题：`确定要取消订阅「{网站名称}」吗？`
     - 内容：`取消后，你将不会再收到该网站的 AI 简报。`
     - 按钮：`取消`（普通）、`确定取消订阅`（危险，红色）。
   - 确认后：调用`deleteSubscriptionAndCleanup(subIdOrUrl)`清理订阅与相关 Digest；`applySubscribeStyle`令主按钮回到`Subscribe`态；`card-controls`隐藏。

### 订阅设定页面（Settings → Subscriptions）
1. 在`components/settings_panel.html`新增分区“订阅设定”：
   - 列表显示`localStorage('rune_subscriptions')`中的所有订阅：站点名称/URL、当前频率。
   - 每行提供频率下拉框：`manual`、`every_1m`、`hourly`、`every_6h`、`daily`。
   - 变更即写入`localStorage('rune_subscriptions')`并提示“设置已保存”。
2. 在`js/components/settings-panel.js`实现：
   - `openUserSettings()`/`showSettingsPanel()`/`closeSettingsPanel()`与现有`#navSettings`逻辑对齐，复用`utils/dom.js`的`show/hide/openModal/closeModal`。
   - `renderSubscriptionsSettings()`：渲染列表、绑定`change`事件更新`frequency`，与`js/main.js`的调度保持兼容。
   - 可选：提供“导出/清空订阅数据”按钮，复用现有数据管理样式。
3. 删除卡片上的频率弹窗入口（`#freqModal`与`.btn-frequency`），改为仅在“订阅设定页面”管理频率。

### Digest 页面（AI Digest）
1. 卡片右下角补信息：
   - 在 Digest 卡片模板追加右下角区域：展示`生成时间（created_at/updated_at → 相对/绝对时间）`与“查看摘要”小箭头按钮。
   - “查看摘要”按钮与现有卡片点击打开详情同源；保留列表委托，按钮点击触发详情面板。
2. 样式优化（统一风格，更紧凑）：
   - 订阅卡片与 Digest 卡片统一：`rounded-xl`、`border(1px)浅灰`、`shadow-sm`，悬停`hover:shadow-lg`，减少`padding`与空白。
   - 将订阅卡片的`hover:-translate-y-0.5`提升为与 Digest 一致或两者统一为更轻量的浮起，以保证一致性。

## 文案与国际化
- `zh.json`新增：
  - `singleDigestNow`: “立即生成简报（Single Digest）”
  - `unsubscribe`: “取消订阅”
  - `unsubscribeConfirmTitle`: “确定要取消订阅「{name}」吗？”
  - `unsubscribeConfirmMessage`: “取消后，你将不会再收到该网站的 AI 简报。”
  - `subscriptionsSettings`: “订阅设定”
  - `frequency`: “抓取频率”
  - `viewSummary`: “查看摘要”
  - `generatedAt`: “生成时间”

## 兼容性与数据层
- 继续使用`localStorage('rune_subscriptions')`与`localStorage('rune_digests')`；不改动结构字段（`frequency`字段保持）。
- `js/main.js`的`frequencyToMs`与`checkAllSubscriptions`无需改动；频率更新从设置页直接生效。
- `deleteSubscriptionAndCleanup`已实现对 Digest 条目的清理；新增退订菜单复用该方法即可。

## 验收与测试
- 启动开发环境（已有 dev server），在 Dashboard：
  - 订阅卡片不再显示频率/频率按钮；仅保留“立即生成简报（Single Digest）”。
  - 三点菜单出现“取消订阅”；确认弹窗符合文案与按钮风格；确认后退订并更新 UI，后续 Digest 不再包含。
- 打开设置 → 订阅设定：
  - 列表展示所有订阅；每条频率可独立调整；调整后自动保存并提示。
  - 调整为`manual`时该订阅不再参与自动调度；其他频率按既有逻辑轮询。
- Digest 页面：
  - 卡片右下角显示生成时间与“查看摘要”按钮；点击按钮或卡片主体均可打开详情面板。
  - 所有卡片统一浅边框 + 轻阴影 + 紧凑排版，视觉一致且信息更集中。

—— 请确认以上方案，确认后我将按上述文件位置逐项落地实现，并在关键改动处加入详细中文注释。