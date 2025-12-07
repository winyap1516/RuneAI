## 问题与根因
- Subscribe 按钮与卡片“三点”不响应：事件委托绑定在初始化时的 `cardsContainer` 上，视图切换或重新渲染后容器被替换，导致原绑定失效。
- AI Digest需支持“模拟生成”：当前 Digest 仅展示已生成数据列表，缺少在该页面快速生成 mock 日报的入口。

## 修复方案（不改数据结构）
### 1. 将事件委托迁移到文档级
- 使用 `document` 作为委托根，避免容器重建导致的监听失效：
  - 订阅按钮：`delegate(document, '.btn-subscribe', 'click', handler)`（替代 `cardsContainer` 绑定，参考现有订阅逻辑在 js/features/dashboard.js:781）。
  - 卡片菜单按钮：`delegate(document, '.more-btn', 'click', handler)`（迁移 js/features/dashboard.js:811 的逻辑）。
  - 菜单项（编辑/删除/重新生成）：统一迁移到 `document` 委托，保留当前 `preventDefault/stopPropagation/stopImmediatePropagation` 与 `closeUserDropdown()`（参考 js/features/dashboard.js:828/837/880）。
- 增加统一 `getCardsContainer()` 工具或在每次使用时即时 `document.getElementById('cardsContainer')`，避免闭包持有旧节点。

### 2. 强化渲染后的状态同步
- 在以下路径调用 `markSubscribedButtons()`，确保按钮显示正确状态：
  - 新卡片插入后（js/features/dashboard.js:716 旁）
  - 云端拉取渲染后（js/features/dashboard.js:741 旁）
  - 示例注入后（js/features/dashboard.js:759 旁）
  - `renderDefaultMain()` 执行后（js/features/dashboard.js:375）

### 3. 视觉稳健性
- 为 `.rune-card` 添加 `position: relative`，为菜单 `.rune-card-menu` 增加高 `z-index`，避免菜单被其他层压住（不影响功能，但提升稳定性）。

### 4. AI Digest 增加“模拟生成”入口
- 在 `renderDigestView()` 顶部加入按钮“模拟生成当日简报”：
  - 点击后：
    - 选中订阅（若无订阅则以当前 `rune_cards[0]` 的 URL 作为目标，或使用 Example Domain 作为占位）
    - 调用 `mockFetchSiteContent(url)` 与 `mockAIFromUrl(url)` 生成一条 digest（date=今日），写入 `localStorage.rune_digests`
    - 触发 Toast 提示并刷新 Digest 列表
- 保持现有筛选（日期/订阅）与“下载 JSON”逻辑不变（参考 js/features/dashboard.js:396–460）。

### 5. 端到端验证
- 点击卡片“Subscribe”：按钮切换为“Subscribed”，侧栏出现订阅项
- 点击卡片“三点”：菜单展开；编辑/删除/重新生成摘要功能正常
- 在 AI Digest 页面点击“模拟生成当日简报”：新增卡片展示当日摘要；点击卡片打开详情面板查看 AI 原始内容与站点快照

## 参考位置（当前代码）
- 事件委托绑定：`js/features/dashboard.js:781`（订阅按钮当前绑定在 `cardsContainer`）与 `js/features/dashboard.js:811`（more-btn）
- Digest 列表与下载：`js/features/dashboard.js:396–460`
- 视图恢复：`js/features/dashboard.js:375`

确认后我将按上述方案迁移事件委托到文档级、补全状态同步与 Digest 模拟生成按钮，并进行端到端验证。