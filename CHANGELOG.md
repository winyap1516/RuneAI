# 更新日志 (CHANGELOG)

## v0.3.12 - 2025-11-08
### Changed（修改）
- 统一组件注释的脚本归属与路径：
  - `modal_login.html` / `modal_signup.html` 注释改指向 `js/features/auth_ui.js`（登录/注册交互由特性模块统一初始化）。
  - `profile_form.html` 注释改指向 `js/components/profile-form.js`（资料编辑交互外置组件模块）。
  - `settings_panel.html` 注释改指向 `js/components/settings-panel.js`（设置与导入/导出逻辑外置组件模块）。
  - `dropdown_user.html` 注释改指向 `js/components/user-dropdown.js`（用户下拉统一绑定与事件派发）。
  - `card_userinfo.html` 已保持指向 `js/components/user-welcome-card.js`。
- 清理所有组件内 `<script>` 标签（巡检确认无残留），严格执行“组件仅含 HTML”。

### Fixed（修复）
- 组件脚本路径注释与实际模块命名不一致可能导致的误导已修正；避免后续贡献者按照旧注释错误引用。

### Planned（计划中）
- 在构建阶段加入静态检查：扫描 `components/*.html` 禁止 `<script>` 标签，校验注释指向的 `js/components/*` 与 `js/features/*` 是否存在。

## v0.3.11 - 2025-11-08
### Added（新增）
- Dashboard 纯净化规则落实：未登录用户在 `dashboard.html` 不显示任何登录/注册元素或提示。

### Changed（修改）
- `js/dashboard.js`：移除未登录欢迎内容渲染（`getGuestUserHTML` 返回空；未登录时欢迎卡容器置空），与入口认证守卫配合。
- `components/dropdown_user.html` + `js/features/user_dropdown.js`：Dashboard 页面隐藏 `authButtons` 登录/注册按钮，仅显示已登录头像。
- `components/card_userinfo.html`：确认仅包含 `welcomeUser`（已登录）内容，未登录块已删除。
- `js/main.js`：在初始化过程中增加认证守卫，未登录访问 `dashboard.html` 时重定向到 `index.html`。

### Fixed（修复）
- 预览时的 `SyntaxError: Unexpected reserved word` 问题：将入口 `init` 改为 `async` 并修复相对导入，避免脚本执行中断。

### Planned（计划中）
- 巡检其余组件在 Dashboard 场景下的显示条件，确保无残留未登录元素；补充最小 E2E 测试覆盖登录守卫与重定向行为。

## v0.3.10 - 2025-11-08
### Added（新增）
- 设置面板数据管理：恢复导入/导出入口（Settings → 数据管理），导出单个 JSON 包含 `linkData/categories/runes/kbFiles/user`；导入时自动合并并按主键/域名+标题去重。
- 新增模块 `js/features/settings_panel.js`：外置 Settings 逻辑，移除组件内联脚本，入口统一初始化。

### Changed（修改）
- `components/settings_panel.html` 彻底移除 `<script type="module">`，遵循“组件仅含 HTML”规范；在数据管理分区增加“导入用户数据（合并去重）”。
- `js/main.js` 引入并初始化 `initSettingsPanel()`，在组件注入后绑定交互与导入/导出逻辑。

### Fixed（修复）
- 解决开发预览中 `modal_signup.html?html-proxy...` 报错的根因：逐步移除组件内联模块脚本，避免 Vite `html-proxy` 代理导致的路径解析与加载失败。

### Planned（计划中）
- 后续迁移 `profile_form.html` 脚本为外置模块，统一入口绑定；完善多语言路径前缀支持与词条巡检（≥20）。

## v0.3.8 - 2025-11-07
### Added（新增）
- PRD v0.1 对齐检查与进度报告（收藏系统、用户系统、三语、导入/导出、Mock AI 入口）。
- 新增 Solo 报告：`/solo/solo_result_20251107.md`，记录本次排查与结论、未决问题与下一步计划。
 - 新增模块 `js/features/user_dropdown.js`：统一绑定用户下拉菜单交互，移除组件内联脚本。

### Changed（修改）
- 明确组件策略：`modal_signup.html` 保持为纯 HTML，无内联脚本；登录/注册交互由 `js/features/auth.js` + `js/main.js` 统一初始化。
- 路径策略复核：组件加载统一 `./components/...`；组件脚本（如 settings/profile）如需保留内联 `<script type="module">`，其导入统一为 `../js/...` 相对路径。
 - 重构 `components/dropdown_user.html`：去除所有 `onclick` 与 `<script>`，改为使用自定义事件与外部模块绑定。

### Fixed（修复）
- 再次验证并确认 `net::ERR_ABORTED http://localhost:5173/components/modal_signup.html?html-proxy&index=0.js` 不再出现（文件已无 `<script>`，路径与加载守卫均生效）。
- 澄清：Tailwind CDN 与该错误无关；问题源于组件内联模块脚本在 Vite dev 的 `html-proxy` 下路径解析不当。

### Planned（计划中）
- 迁移剩余组件内联脚本至特性模块（统一“组件仅含 HTML”规范），彻底避免 `html-proxy` 风险。
- 恢复导入/导出功能至 Settings → 数据管理分区（合并 `linkData`/`categories`，导入去重并刷新侧栏）。
- 多语言词包路径增强（支持部署前缀/基路径），并进行词条覆盖巡检（≥20）。

## v0.3.9 - 2025-11-08
### Changed（修改）
- 欢迎卡片 `components/card_userinfo.html`：移除内联 `<script type="module">`，脚本逻辑外置为 `js/features/user_welcome_card.js`，避免 Vite html-proxy 对组件脚本的代理导致路径解析错误。
- 入口 `js/main.js`：新增 `initUserWelcomeCard()` 初始化逻辑，组件注入后执行渲染与事件绑定，统一事件监听（`loginSuccess/logout/profileUpdated/settingsUpdated`）。

### Fixed（修复）
- 预览 `dashboard.html` 无 `net::ERR_ABORTED` 与 404；欢迎卡片脚本由入口统一加载，无 html-proxy 报错风险。

### Planned（计划中）
- 巡检其余组件脚本：`settings_panel.html` / `profile_form.html` 保留的 `<script type="module">` 逐步迁移至外置特性模块，统一“组件仅含 HTML”规范。

## v0.3.7 - 2025-11-07
### Added（新增）
- 新增 Solo 报告：`/solo/solo_result_20251107.md`，梳理 PRD v0.1 的实现差距与迭代计划（收藏系统、用户系统、三语、导入/导出、Mock AI 入口）。
- 在 `/solo/solo_questions.json` 追加不确定项（导入/导出入口位置、语言包路径策略、AI Digest 展现形态、自动登出触发条件）。

### Changed（修改）
- 统一规范：组件 HTML 不含 `<script>`，登录/注册弹窗交互迁移至 `js/features/auth.js` 并由 `js/main.js` 初始化。
- 明确语言模块导出约定：`language.js` 默认导出 `i18n`，具名导出 `setLanguage`；检查各处导入保持一致。

### Fixed（修复）
- 再次验证并确认 `ERR_ABORTED` 路径问题已消失（index/dashboard 预览均正常）。

### Planned（计划中）
- 恢复导入/导出功能到 Settings → 数据管理分区（JSON 文件解析、合并去重、错误提示）。
- Digest 最小可用入口与 Mock 展现（独立页或弹窗）并预留“保存为符文卡片”按钮。
- 多语言加载路径支持部署前缀或基路径；词条覆盖巡检（≥20）。
- 用户系统的“记住我 / 自动登出”实现细化（空闲检测 + 定时器）。

## v0.3.6 - 2025-11-08
### Added（新增）
- 将“登录/注册”弹窗容器从 `dashboard.html` 迁移到 `index.html`（登录前页面）。
- 在 `js/main.js` 增加组件加载守卫：仅在容器存在时加载对应组件，兼容多页面结构。
- 推荐在入口页设置 `<base href="./">` 以稳定相对路径解析（子路径部署更可靠）。
- 新增特性模块 `js/features/auth.js`，统一登录/注册弹窗的初始化与事件绑定；移除组件内联脚本。

### Changed（修改）
- 统一加载职责：入口页仅引入 `./js/main.js`；由 `main.js` 负责 `fetch('./components/*.html')` 挂载组件并做事件绑定/初始化。
- 规范路径策略：禁止以 `/js/...` 绝对路径导入，统一为 `./js/...` 或相对路径；组件加载统一 `./components/...`。
- 为不同页面场景加装“存在性检查”，避免在 `index.html` 触发 Dashboard 专属事件绑定。
- 组件规范调整：组件 HTML 不再包含 `<script type="module">`；改为通过特性模块在入口脚本统一初始化（入口轻、功能分包、无内联脚本）。

### Fixed（修复）
- 消除 `net::ERR_ABORTED http://localhost:5173/components/modal_signup.html?html-proxy&index=0.js`（由组件内联模块脚本的相对路径不当引发，现通过相对路径与加载守卫消除）。
- 修复 `index.html` 预览中 `TypeError: Cannot read properties of null (reading 'addEventListener')`（为保存按钮事件绑定增加元素存在性检查）。

### Planned（计划中）
- 组件纯 HTML 化：逐步移除组件内的 `<script>`，把逻辑集中到 `main.js` 统一初始化，避免 `innerHTML` 注入脚本不执行的问题。
- 增加静态校验：构建阶段扫描禁止 `/js/` 绝对路径与组件内 `<script>` 标签；路径规范写入 `README`。

## v0.3.3 - 2025-11-08
### Added（新增）
- 完成 `dashboard.html` 主系统页面，统一使用 Tailwind CDN 和组件化架构。
- 建立清晰的项目结构，分离 `index.html`（Landing）与 `dashboard.html`（主系统）。
- 在 `main.js` 中实现统一的 `loadComponent` 函数，使用相对路径 `./components/` 加载组件。
### Changed（修改）
- 统一所有组件加载路径为 `./components/` 格式，解决 404 错误。
- 移除外部 CSS 文件依赖，所有样式使用 Tailwind 内联 class。
- 重构页面架构：`index.html` 作为 Landing 页面，`dashboard.html` 作为主系统页面。
### Fixed（修复）
- 修复组件路径错误导致的页面空白塌陷问题。
- 修复 Tailwind CDN 模式与 `@apply` 规则冲突导致的样式失效。
- 修复 Modal 组件默认显示导致的页面重叠问题。
- 解决模块加载顺序混乱和路径不一致问题。
### Planned（计划中）
- 增加静态路径检查脚本，自动验证组件路径正确性。
- 为用户系统添加完整的测试覆盖。
- 优化组件加载性能和错误处理机制。

## v0.3.5 - 2025-11-08

### Added
- 补充 PRD（`.trae/rules/documents/prd.md`）大方向文档到工作说明引用。

### Changed
- 组件脚本导入路径统一为相对路径（`../js/...`），与 Vite 开发时的 `html-proxy` 解析保持一致，避免被解析为 `components/js/...` 导致 404。

### Fixed
- 修复 `modal_signup.html` 的 `type="module"` 导入路径，解决 `net::ERR_ABORTED http://localhost:5173/components/modal_signup.html?html-proxy&index=0.js`。
- 预览 `dashboard.html` 未再出现组件加载报错，登录/注册/设置/资料卡片脚本均可正常执行。

### Planned
- 为构建阶段加入静态路径检查脚本（扫描 `components/*.html` 的 `type="module"` 导入是否使用相对路径）。
- 最小单测覆盖：对 `loadComponent()` 进行基本行为测试（DOM 注入与脚本执行）。

---

## v0.3.4 - 2025-11-08
### Added（新增）
- 文档：在 `blueprint.md` 补充 v0.3.3 的结构化分节说明（结构/路径/样式/交互/验证）。

### Changed（修改）
- 组件脚本导入路径统一为相对路径：从 `components/` 指向根目录 `js/` 改为 `../js/...`，兼容 Vite dev server 的 `html-proxy` 行为与静态部署场景。

### Fixed（修复）
- 修复预览中的 6 条组件加载错误（`dropdown_user.html`/`modal_login.html`/`modal_signup.html`/`profile_form.html`/`settings_panel.html`/`card_userinfo.html`），不再出现 `net::ERR_ABORTED` 与 404。
- 验证 `dashboard.html` 加载无报错；组件脚本执行与交互正常（Modal 默认隐藏、下拉菜单切换、欢迎卡渲染）。

### Planned（计划中）
- 构建阶段加入静态路径检查脚本，确保 `./components/` 与 `../js/` 引用一致；补充最小单测覆盖（组件加载成功、Modal 默认隐藏与切换）。

## v0.3.1 - 2025-11-07

## v0.3.2 - 2025-11-07
- Added：移除 `dashboard.html` 中的 Tailwind `@apply` 样式块，改写为原生 CSS，确保在 CDN 模式下样式稳定。
- Changed：统一样式策略说明——仅使用 Tailwind CDN 与原生 CSS/类名；不引入外部 CSS 文件与 `@apply` 规则，避免 JIT 缺失导致样式失效。
- Fixed：Dashboard 页面在部分浏览器下的用户系统组件样式不生效问题（源于 `@apply` 在 CDN 模式失效）。
- Planned：在构建阶段加入静态路径与样式规则检查（禁止 `@apply` / 校验 `./components/` 路径存在性），并补充最小单测覆盖 `auth.js` 与 `language.js` 的导入约定。

- Added（新增）
  - 新增独立注册页面 `signup.html`，使用 Tailwind CDN 与内联类名，表单提交后跳转 `dashboard.html`。
  - 将 `index.html` 重构为纯 Landing 页面，统一导航与按钮跳转（登录 → `dashboard.html`，开始使用 → `signup.html`）。

- Changed（修改）
  - 统一页面脚本与样式引用策略：仅保留 Tailwind CDN；不再加载外部 CSS（避免 `@apply` 在 CDN 模式下失效）。
- 路由与资源路径梳理：注册页脚本引入 `import { mockSignup } from 'js/auth.js'`（统一相对路径，兼容子路径/静态站点部署）。

- Fixed（修复）
  - 首页与注册页预览通过（`index.html` / `signup.html` / `dashboard.html`），无控制台报错、无 404 资源丢失。
  - 修复因路径与样式混用导致的首页塌陷问题：移除旧的外部 CSS 与 `@apply` 冲突，组件样式全部使用内联类名。

- Planned（计划中）
  - 增加静态检查脚本：在构建阶段校验 `./components/` 路径与入口脚本存在性，避免 404。
  - 为页面跳转与组件加载增加最小单测（重定向与组件占位容器挂载）。

## v0.3.0 - 2025-11-07

- Added（新增）
  - 新增 `dashboard.html` 作为主系统页面，统一布局容器与脚本引用。
  - 在 `js/main.js` 中新增通用组件加载函数 `loadComponent` 与初始化方法 `initUserComponents`，统一通过 `./components/` 相对路径加载：用户下拉、登录/注册/资料/设置弹窗与欢迎卡片。

- Changed（修改）
  - 统一 Tailwind 使用方式：仅保留 CDN 引用，不再加载外部 CSS 文件，避免与 `@apply` 冲突。
  - 将组件加载逻辑从 `index.html` 的内联脚本迁移到 `js/main.js`，保证加载顺序与路径一致。

- Fixed（修复）
  - 解决组件路径不一致导致的 404 与页面“空白/塌陷”问题（统一为 `./components/...`）。
  - 确保所有 Modal 默认 `hidden` 且加载后保持隐藏，避免页面堆叠显示。

- Planned（计划中）
  - 在构建阶段加入路径校验脚本，自动检测 `index.html` / `dashboard.html` 引用的组件与脚本是否存在。
  - 为用户系统组件加载增加错误上报与回退提示 UI。

## v0.2.9 - 2025-11-07

- Added（新增）
  - `language.js` 增加具名导出 `setLanguage`（内部调用 `i18n.setLanguage`），兼容组件的具名导入用法。
  - `auth.js` 增加组件别名函数：`mockSignup`、`updateUserProfile`、`updateUserSettings`、`logout`，统一返回结果结构。

- Changed（修改）
  - `auth.updateSettings` 改为写入 `user.settings` 嵌套字段，保持与组件期望一致。

- Fixed（修复）
  - 修复组件中对 `auth.js` 与 `language.js` 的导入不匹配导致 Vite 构建失败问题。
  - 开发服务器启动错误（No matching export）已解决，成功运行于 `http://localhost:5173/`。

- Planned（计划中）
  - 为 `auth`/`language` 模块补充最小单元测试，避免导出/导入回归。
  - 在构建阶段加入脚本路径与导出检查脚本（CI）。

## [0.2.8] - 2025-11-07
### Changed
- 统一入口脚本位置：将 `main.js` 移动至 `js/` 目录，保持前端脚本路径一致性。
- 更新 `index.html` 引用为 `<script type="module" src="js/main.js"></script>`，避免路径不一致导致的 404。
- 修正本地模式导入：`js/main.js` 中对 `mockFunctions.js` 的引用由 `./mockFunctions.js` 改为 `../mockFunctions.js`。
- 根据用户确认：保持 `auth` 命名空间导入（`import * as auth`）与 `language.js` 默认导出 `i18n` 的约定。

### Fixed
- 解决 `net::ERR_ABORTED http://localhost:5173/js/main.js` 加载失败问题（入口脚本路径统一后已消除）。

### Planned
- 可选：在 `language.js` 中额外导出 `I18n` 类用于单元测试（不影响默认导出）。

## [0.2.7] - 2025-11-07
### Added
- 修复用户系统模块对 auth.js 的错误导入：统一改为 `import * as auth from './auth.js'` 并按具名函数调用（`getCurrentUser` / `updateProfile` / `updateSettings` / `doLogout`）。
- 修复 i18n 导入错误：`language.js` 为默认导出，统一改为 `import i18n from './language.js'`。
- 修复脚本路径错误：`index.html` 中的 `main.js` 位于根目录，改为 `<script type="module" src="main.js"></script>`，解决 `net::ERR_ABORTED /js/main.js`。
- 新增用户系统前端模块完整实现
  - 登录/注册弹窗组件（modal_login.html, modal_signup.html）
  - 用户头像下拉菜单组件（dropdown_user.html）
  - 用户资料编辑卡片组件（profile_form.html）
  - 偏好设置面板组件（settings_panel.html）
  - Dashboard 欢迎区组件（card_userinfo.html）
- 新增用户系统核心逻辑模块
  - 认证管理模块（js/auth.js）- 基于 localStorage 的用户登录/注册
  - 用户资料管理模块（js/profile.js）- 头像上传预览、资料保存
  - 偏好设置管理模块（js/settings.js）- 语言/主题/AI风格设置
  - Dashboard 管理模块（js/dashboard.js）- 用户状态加载与欢迎语生成
- 新增用户系统专用样式文件（user-system-styles.css）
- 新增多语言支持（语言切换功能）
- 新增主题切换功能（亮色/暗色主题）
- 新增用户数据导出/清除功能
- 新增基于 localStorage 的用户数据持久化

### Changed
- 更新 index.html 集成用户系统组件
  - 顶部导航栏添加用户系统区域
  - 主要内容区域添加 Dashboard 欢迎卡片
  - 添加用户系统弹窗容器
  - 动态加载用户系统组件
- 保持现有 UI 风格一致性

### Planned
- 用户系统与后端 API 集成
- 用户数据云端同步功能
- 社交登录集成（Google/GitHub）

---

## [0.2.6] - 2025-11-06
### Added
- 新增 Solo 工作流目录与文件：`/solo/solo_questions.json`、`/solo/solo_reflection.md`、`/solo/solo_result_template.md`。

### Changed
- 将 `solo_reflection.md` 优化为可执行检查表（Action Items + Improvement Proposals + 结构示意），支持自动勾选已完成项。

### Planned
- 引入规则文件版本化追踪（对比 `solo_rules.md` 哈希/时间戳）与运行时重载提示。


## [0.2.5] - 2025-11-05
### Added
- 折叠态 Logo 居中内边距（`.aside-collapsed img { padding: 0.5rem; }`）。

### Changed
- 侧栏采用 `flex flex-col justify-between` 布局，移除默认 `p-4`，减少顶部空白。
- LOGO 容器改为垂直居中 + 下边界线分隔（`py-4 + border-b`），统一圆形样式。
- 导航容器补充 `px-4` 内边距，维持展开/收起视觉平衡。

### Fixed
- 解决 SyntaxError：`/js/auth.js` 不存在名为 `auth` 的导出，导致 `import { auth }` 报错；现已替换为命名空间导入。
- 解决语言模块导出不匹配：`language.js` 默认导出 `i18n`，已更正所有模块导入方式。
- 解决前端脚本路径导致的 404：`main.js` 路径修正后，开发服务器加载正常。
- 修复左上角空白塌陷：移除旧容器占位（`mb-4`），Logo 居中且不偏移。
- 展开/收起视觉统一：折叠时 Logo 保持显示、居中且不与 Header 冲突。

### Planned
- 折叠态进一步压缩 `nav-item` 间距以增强信息密度。


## [0.2.4] - 2025-11-05
### Added
- 左侧导航分区（LINKS / AI FEATURES / USER）与 Accordion 折叠逻辑。
- LINKS 组：重写 `renderSidebarCategories` 渲染到 `#linksGroupList`，底部新增 `+ New Category`。
- 响应式：侧栏窄屏图标模式与 tooltip 保留（`setupSidebarToggle`）。
- AI Digest：绿色小圆点提示（`updateDigestIndicator` 读取 `localStorage.digestHasNew`）。

### Changed
- 侧栏交互与样式：柔光悬停（`.soft-hover`）、激活项左侧渐变指示条（`.nav-item.active::before`）。
- 分类删除逻辑简化为前端本地更新（与 `USE_LOCAL_DB` 一致）。
- 顶栏品牌标题移至与搜索框同一行，侧栏顶部仅保留圆形 Logo。

### Fixed
- `addCategoryBtn` 获取方式统一为 `document.getElementById("addCategoryBtn")`，避免选择器不一致导致事件丢失。
- 修复整体布局走位：纠正 `<aside>` 嵌套与闭合结构；测试按钮移入 `<main>`。

### Planned
- Digest 接入真实后端数据源，替代 `localStorage` 标志位。

---

## [0.2.3] - 2025-11-05
### Added
- 本地开发模式开关 `USE_LOCAL_DB`，支持离线运行（禁用 Supabase/fetch，写入 localStorage，使用 mock AI）。
- 新增 `mockFunctions.js` 返回虚拟 AI 内容，简化离线开发体验。
- `super-endpoint` 增加 `GET` 健康检查，便于通过 `serve` 验证 `Deno.env.get("SUPABASE_URL")`。
- 初始化并维护根目录 `.env` 文件（`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `OPENAI_API_KEY`）。

### Changed
- `main.js` 的新增/编辑/删除逻辑在本地模式下跳过所有网络调用，仅本地持久化。
- Function 测试按钮在本地模式走 `mockFunctions.js`。

### Planned
- 后续将为 `delete-link` / `update-link` 增加更细致的错误码与前端提示策略。

---

## [0.2.2] - 2025-11-05
### Fixed
- 固定开发服务器端口为 `5173`（设置 `strictPort: true`），避免端口漂移导致的 `localStorage` 同源不一致与数据“看似丢失”。

### Removed
- 移除顶部“数据管理”相关按钮与逻辑：`导出数据` / `导入数据` / `从云端加载`（保持 UI 简洁、一致）。

### Improved
- 简化顶部导航布局，视觉更平衡；启动体验统一为 `http://localhost:5173/`。

### Planned
- 若需跨设备/浏览器同步，后续将改由后端统一策略（如账户登录 + 云端同步），替代前端导入/导出入口。

---

## [0.2.1] - 2025-11-05
### Added
- 页面顶部新增“数据管理”区域（导出/导入/从云端加载）
- 导出为 JSON（包含 `linkData` 与 `categories`）
- 导入 JSON 并按域名键去重合并数据（使用 `normalizeUrl` + `getDomainKey`）
- 从云端加载：调用 `/functions/v1/list-links` 合并数据（返回 `{ links: [] }`）

### Changed
- 初始化流程绑定数据管理事件（`setupDataManagement()`）

### Planned
- Supabase 数据库为 `url` 或 `domain_key` 建立唯一索引（避免重复）
- 前端处理后端返回 409 冲突的用户提示与引导

---

## [0.2.0] - 2025-11-05
### Added
- 接入 Supabase Edge Functions（super-endpoint / delete-link / update-link）
- 删除与编辑操作同步数据库（匿名调用，仅 `Content-Type` 头）
- URL 规范化（协议补全、域名小写、去除 `www`）与本地去重校验
- 搜索功能（标题/摘要/标签/URL 实时过滤）
- 侧边栏分类聚合与删除迁移逻辑
- Edge Function 测试按钮与事件绑定

### Changed
- 前端取消直接写数据库，统一由 Edge Function 写库
- 移除前端本地缓存自动同步（保留 `cacheToLocal` 作为离线备用）
- `callSupabaseAI` 仅保留 `Content-Type`，移除认证头
- 全面补充中文注释与交互提示

### Fixed
- 解决同一域名（`www.openai.com` 与 `openai.com`）重复入库问题
- 修复新增/编辑时 URL 规范化导致的重复保存

### Planned
- AI 自动追踪网站更新与摘要（v0.3）
- 每日/每周报告生成与导出（v0.4）
- 与 YinGAN OS 符文系统对接（v1.0）

---

## [0.1.0] - 2025-11-05
### Added
- 创建项目并初始化网页收藏卡功能
- 完成 README / Blueprint / Changelog 模板

### Planned
- 收藏卡分组与搜索功能
- 自动检测网页更新与 AI 摘要生成功能
