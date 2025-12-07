## 目标概述
- 为 `All Links` 的所有卡片（示例与新增）统一采用全新的现代卡片模板，具备圆角、柔和阴影、悬浮提升、分区结构与彩色标签。
- 新增 `createCard(data)` 与 `mockAIFromUrl(url)`，替换当前示例渲染与保存逻辑，统一卡片 UI。

## 涉及文件
- `dashboard.html`：增加极少量 CSS 辅助类（摘要三行截断、分隔线渐变、标签 pill 基础样式）。
- `js/features/dashboard.js`：新增函数并替换 `seedDemoCards()` 和保存链接按钮逻辑。

## 新增函数
- `createCard(data)`（返回 HTML 字符串）：
  - 结构分为四块：
    - 顶部行：左侧图标方块（favicon 或标题首字符）、标题、右侧更多按钮 `more_horiz`；
    - 摘要文本（AI Summary）：使用自定义 CSS 实现 `-webkit-line-clamp: 3` 截断；
    - 分隔线：浅色渐变细线；
    - 底部标签：彩色 pill 标签，按关键字自动映射颜色。
  - 统一使用 Tailwind 类实现圆角、柔和阴影与 hover 提升（如 `rounded-xl`, `shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition`，搭配 `bg-surface-light dark:bg-surface-dark` 与边框）。
  - 标签颜色映射规则：
    - 包含 `ai`/`research` → 紫色（`bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300`）
    - 包含 `design`/`ux` → 粉色（`bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-300`）
    - 包含 `productivity` → 绿色（`bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-300`）
    - 包含 `development` → 蓝色（`bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300`）
  - HTML 中包含必要的类名前缀（如 `rune-card`, `rune-card-desc`, `rune-card-divider`, `rune-tag`），便于样式与查询。
- `mockAIFromUrl(url)`：
  - 解析域名与路径，输出：`title`, `description`, `category`, `tags`；
  - 规则示例：
    - 命中 `figma|design|ux` → `Design` 类别与标签
    - 命中 `openai|ai|arxiv|paper|research` → `AI/Research`
    - 命中 `github|dev|docs|api` → `Development`
    - 命中 `notion|todo|task|calendar|productivity|workflow` → `Productivity`
  - `title` 取域名或路径关键字友好化；`description` 生成 1 段中文 AI 摘要占位。

## CSS 增补（只修改 `dashboard.html` 现有 <style> 片段）
- 增加：
  - `.rune-card-desc`：`display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;`（实现 3 行截断）。
  - `.rune-card-divider`：高度 1px，使用浅色渐变背景（暗色模式下加深）。
  - `.rune-tag`：圆角 pill 基础样式与内边距（具体颜色通过 Tailwind 类在 HTML 上赋值）。
- 保留 Tailwind CDN 模式，不新增外部 CSS 文件。

## 集成改动
- 替换保存逻辑（`js/features/dashboard.js:256`）：
  - 点击 `saveLinkBtn` → 读取 `inpUrl` → `mockAIFromUrl(url)` → `createCard(data)` → 将卡片 HTML 插入 `#cardsContainer` 的 `afterbegin` → 清空输入并关闭模态。
- 统一替换示例渲染（`js/features/dashboard.js:313` 起）：
  - `seedDemoCards()` 组装示例数据（含标签），通过 `createCard()` 批量渲染，替换当前硬编码 HTML。

## 卡片模板细节
- 顶部行：
  - 左侧 40×40 图标方块：
    - 若可用 `favicon`（可选）则 `<img>`；否则使用标题首字符，带渐变/色块背景。
  - 中间标题：`text-base font-bold`，颜色随主题切换；
  - 右侧更多按钮：`<button>` 包含 `material-symbols-outlined more_horiz`，预留点击占位。
- 摘要文本：
  - 使用 `.rune-card-desc` 保证最多 3 行显示，超过自动省略。
- 分隔线：
  - `.rune-card-divider` 渐变背景细线，增强层次。
- 标签区域：
  - `flex flex-wrap gap-2`；每个标签 `span` 应用 `rune-tag` 基础类 + 颜色类（由映射函数给出）。

## 代码注释
- 所有新增/修改代码添加详细中文注释，说明设计意图、交互流程与兼容性考虑（满足您的注释要求）。

## 验证与回归
- 打开 Dashboard：
  - 确认示例卡片样式统一、悬浮提升与阴影效果正常；
  - 通过 `Add Link` 粘贴不同站点 URL，校验 `mockAIFromUrl` 映射的类别/标签与摘要截断；
  - 搜索筛选仍可针对新卡片文本生效；
  - 深色/浅色模式下对比阴影、分隔线与标签颜色是否清晰。

## 变更范围与安全
- 不新增文件；仅在现有两个文件内小幅修改/增补。
- 保持现有交互（侧栏折叠、视图切换、模态）不受影响。

请确认以上方案，确认后我将直接实现、联调并完成可视化验证。