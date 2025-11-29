# WebBookmark AI Assistant Blueprint

## 🌐 项目目标
打造一个个性化网页收藏与智能追踪系统，
让 AI 成为用户的私人网页助理，自动提炼每日最新动态。

---

## 🧩 模块规划

### 1️⃣ 收藏模块（v0.2） ✅ 完成阶段
- 新增 / 编辑 / 删除收藏卡（含 UI 菜单与弹窗）
- 分类与标签系统（侧边栏聚合、分类删除迁移）
- 搜索过滤（标题 / 摘要 / 标签 / URL 实时）
- URL 规范化（协议补全、域名小写、去除 `www`）与本地去重
- 与 Supabase Edge Functions 同步（新增、删除、编辑）
- 取消前端直写数据库，统一后端写库
- 保留 `cacheToLocal` 作为离线备用
- 顶部数据管理：❌ 已移除（导出 / 导入 / 从云端加载）
  - 还原方案（v0.3.10 已完成）：在 Settings → 数据管理中恢复“导出/导入”入口；导出合并 `linkData`/`categories`；导入解析 JSON 并去重合并；逻辑外置至 `js/features/settings_panel.js` 并由入口 `js/main.js` 初始化，组件不再包含 `<script type="module">`。
- 新增：✅ 本地开发模式（`USE_LOCAL_DB`）与 `mockFunctions.js`，允许离线运行
- 新增（v0.2.4-0.2.5）：✅ 左侧导航分区（LINKS/AI/USER）、Accordion 折叠、窄屏图标模式、Digest 绿色小圆点提示、顶栏品牌迁移到搜索框同行（侧栏顶部仅 Logo），修复侧栏 Logo 视觉塌陷（flex 布局、居中 + 分隔线、折叠态优化）。

### 2️⃣ 用户系统模块（v0.2.7） ✅ 完成阶段
- 登录/注册弹窗组件（modal_login.html, modal_signup.html）
- 用户头像下拉菜单组件（dropdown_user.html）
- 用户资料编辑卡片组件（profile_form.html）
- 偏好设置面板组件（settings_panel.html）
- Dashboard 欢迎区组件（card_userinfo.html）
- 认证管理模块（js/auth.js）- 基于 localStorage 的用户登录/注册
- 用户资料管理模块（js/profile.js）- 头像上传预览、资料保存
- 偏好设置管理模块（js/settings.js）- 语言/主题/AI风格设置
- Dashboard 管理模块（js/dashboard.js）- 用户状态加载与欢迎语生成
- 用户系统专用样式文件（user-system-styles.css）
- 多语言支持（语言切换功能）
- 主题切换功能（亮色/暗色主题）
- 用户数据导出/清除功能
- 基于 localStorage 的用户数据持久化
- 更新 index.html 集成用户系统组件
- 保持现有 UI 风格一致性
- 修复导入一致性与路径：统一 `auth` 命名空间导入、`i18n` 默认导入；修正入口脚本路径为 `js/main.js` 并更新 `index.html` 引用。
  - v0.3.7：PRD v0.1 对齐计划落地到文档与任务（Solo 报告），新增不确定项记录（导入/导出入口位置、语言包路径策略、Digest 展现形态、自动登出触发条件）。

### 2️⃣.4 页面职责划分与加载守卫（v0.3.6） ✅ 完成阶段
- 职责划分：`index.html`（登录前）承载“登录/注册”弹窗；`dashboard.html`（登录后）承载“资料/设置/欢迎卡/下拉菜单”。
- 入口策略：入口仅引入 `./js/main.js`；由 `main.js` 统一 `fetch('./components/*.html')` 挂载组件并在挂载后做事件绑定与初始化。
- 路径与解析：推荐入口设置 `<base href="./">` 稳定相对路径解析；禁止 `/js/...` 绝对路径；统一 `./components/...` 与 `./js/...`。
- 加载守卫：`main.js` 仅在容器存在时加载对应组件，避免在不同页面产生无效加载与报错。
 - 组件规范：移除组件内的 `<script type="module">`，由 `js/features/auth.js` 统一初始化登录/注册弹窗与事件绑定（入口轻、功能分包、相对路径）。
  - 复核：`modal_signup.html` 保持纯 HTML，不含脚本；如需在组件内保留脚本（settings/profile），其模块导入统一为 `../js/...` 相对路径，避免 `html-proxy` 误解析。
  - 纯净化加强（v0.3.11）：Dashboard 页面不再显示任何“登录/注册”相关元素；`dropdown_user` 在 Dashboard 场景下隐藏 `authButtons`；`card_userinfo` 移除未登录块；`main.js` 增加认证守卫，未登录访问自动跳转到 `index.html`。

### 2️⃣.1 导出兼容与服务器稳定性（v0.2.9） ✅ 完成阶段
- 语言模块：`language.js` 增加具名导出 `setLanguage`（内部代理到 `i18n.setLanguage`），兼容组件具名导入。
  - 加强（计划）：语言包加载路径支持部署前缀或基路径，避免绝对路径在子路径部署下 404；词条覆盖检查（≥20）。
- 认证模块：`auth.js` 增加组件调用别名（`mockSignup`/`updateUserProfile`/`updateUserSettings`/`logout`），返回统一结构。
- 设置写入：`auth.updateSettings` 改为写入 `user.settings`，与 `settings_panel.html` 读取逻辑一致。
- 结果：Vite 开发服务器启动错误（No matching export）已修复，预览正常。

### 2️⃣.6 PRD v0.1 对齐检查（v0.3.8） ✅ 完成阶段
- 收藏系统：新增/编辑/删除/分类/标签/搜索 已具备；导入/导出需在 Settings → 数据管理恢复。
- 用户系统：登录/注册 Modal（index 页面）、资料与偏好（dashboard 页面）已具备；事件与状态联动正常。
- 多语言系统：三语词包 `/languages/zh.json|en.json|ms.json` 与 `data-i18n` 绑定已覆盖；需补充词条巡检与路径前缀支持。
- Mock AI 入口：具备最小入口与匿名调用（本地模式）；Digest 展示与“保存为符文卡片”待完善（v0.3）。
- 导入/导出：用户数据导出已在 Settings；收藏导入/导出按 PRD 需恢复（JSON 合并/去重）。
 - 下拉菜单：重构 `dropdown_user.html` 为纯 HTML；新增 `js/features/user_dropdown.js` 在入口脚本中初始化，移除内联脚本与 `onclick`，使用自定义事件派发（`openLoginModal/openSignupModal/openUserProfile/openUserSettings/logout/languageChanged`）。

### 2️⃣.7 欢迎卡片脚本外置（v0.3.9） ✅ 完成阶段
- 组件规范强化：`components/card_userinfo.html` 移除内联 `<script type="module">`，统一由入口初始化与事件绑定。
- 新增特性模块：`js/features/user_welcome_card.js`，负责欢迎卡片渲染、事件监听（`loginSuccess/logout/profileUpdated/settingsUpdated`）、登录时长刷新定时器。
- 入口更新：`js/main.js` 在加载欢迎卡组件后调用 `initUserWelcomeCard()`，统一渲染与绑定，消除 `html-proxy` 路径代理风险。
- 后续迁移计划：对 `settings_panel.html` / `profile_form.html` 保留的模块脚本逐步外置，保持“组件仅含 HTML”原则。
 - 进展（v0.3.10）：`settings_panel.html` 已完成脚本外置为 `js/features/settings_panel.js` 并在入口初始化；同时恢复 Settings → 数据管理 的导入/导出/清除功能，导入支持合并去重，导出统一打包。

### 2️⃣.2 Dashboard 主页面与组件加载统一（v0.3.0） ✅ 完成阶段
- 建立 `dashboard.html` 为主系统页面，`index.html` 作为 Landing。
- 统一通过 `js/main.js` 加载用户系统组件（用户下拉、登录/注册/资料/设置、欢迎卡片）。
- 路径统一为 `./components/` 相对路径，解决 404 与样式挂载失败引发的页面塌陷。
- Tailwind 统一仅使用 CDN，避免与外部 CSS 及 `@apply` 规则冲突导致样式失效。
- Modal 默认 `hidden` 并保持隐藏，防止与主内容重叠显示。

### 2️⃣.3 首页与注册页重构（v0.3.1） ✅ 完成阶段
- 新增独立注册页面 `signup.html`，采用 Tailwind CDN 与内联类名，提交后跳转 `dashboard.html`。
- 将 `index.html` 重构为纯 Landing：统一导航与按钮跳转（登录 → `dashboard.html`，开始使用 → `signup.html`）。
- 移除外部 CSS 与 `@apply` 规则（CDN 模式下不支持），所有样式直接写在 HTML 的 `class` 中。
- 结果：三页预览通过，无控制台报错、无 404 路径错误。

### 3️⃣ AI 追踪模块（v0.3）
- 每日检测关注网站更新
- 自动提取标题 + 摘要 + 时间
- 汇总“今日情报摘要”
- 与 Function 安全集成（匿名调用 / JWT 策略）

### 4️⃣ 报告模块（v0.4）
- 自动生成日报 / 周报
  - Digest 最小可用（计划）：侧栏入口或弹窗展示 Mock 摘要；预留“保存为符文卡片”按钮；符文数据写入 `localStorage.runes`（v0.3 完整化）。
- 分类显示（科技 / 政策 / 公司）
- 支持导出 PDF / JSON

### 5️⃣ 系统集成（v1.0）
- 与 YinGAN OS 的符文系统同步
- 将有价值的动态固化为符文知识卡

---

## 🛠️ 技术实现细节（v0.2）
- Edge Functions 路由：
  - `super-endpoint`：解析网站并写入 `links`（新增 `GET` 健康检查）
  - `delete-link`：根据 URL 删除记录
  - `update-link`：根据 URL 更新标题 / 摘要 / 分类 / 标签
- 前端请求：仅 `Content-Type: application/json`，匿名调用
- 防重策略：统一域名规范化与本地去重校验（`normalizeUrl` / `getDomainKey`）
- 交互提示：详细中文注释与错误处理（超时 / 跨域 / 403/401）
- 新增：本地模式分支在新增/编辑/删除逻辑中跳过网络调用，仅操作 `localStorage`
- 新增（v0.2.4）：侧栏 Accordion 折叠（`setupAccordion`）、窄屏图标模式（`setupSidebarToggle`）、Digest 指示（`updateDigestIndicator`）
 - 新增（v0.2.6）：建立 Solo 工作流目录与模板（`/solo/solo_questions.json` / `/solo/solo_reflection.md` / `/solo/solo_result_template.md`），并将反思总结优化为可执行检查表；规划规则文件版本化追踪机制。
- 新增（v0.2.7）：✅ 用户系统前端模块完整实现，包括登录/注册弹窗、用户头像下拉菜单、用户资料编辑、偏好设置面板、Dashboard 欢迎区、多语言支持、主题切换、基于 localStorage 的数据持久化。

---

## 🔮 长期愿景
让信息 → 成为知识 → 成为智慧  
实现个人的「外界情报感知系统」与「内在记忆系统」闭环。
### 2️⃣.4 Dashboard 样式稳定化（v0.3.2） ✅ 完成阶段
- 移除 Dashboard 页面中的 `@apply` 样式块，改写为原生 CSS，确保在 Tailwind CDN 模式下样式稳定。
- 明确样式策略：仅使用 CDN + 内联类名/原生 CSS；不加载外部 CSS 文件、不使用 `@apply`。
- 预览验证：Dashboard 用户系统组件样式（下拉/模态/欢迎卡）正常显示，控制台无报错。

### 2️⃣.5 Dashboard 结构与加载稳定化（v0.3.3） ✅ 完成阶段
- 完成 `dashboard.html` 主系统页面结构与组件化架构，分离 `index.html`（Landing）与 `dashboard.html`（主系统）。
- 在 `js/main.js` 中实现统一的 `loadComponent` 函数，并增强执行组件内联脚本与 `type="module"` 脚本，确保组件加载逻辑生效。
- 统一组件加载路径为 `./components/` 相对路径，避免子路径与静态部署下的根路径 404。
- 保持样式策略一致：Tailwind CDN + 内联类名/原生 CSS；不使用外部 CSS / `@apply`。
- 验证：`dashboard.html` 预览正常，控制台无报错；Modal 默认隐藏且关闭逻辑有效；用户下拉、欢迎卡、资料与设置组件均正常挂载。
 
#### 结构优化
- 建立清晰的项目架构：`index.html` 作为 Landing 页面，`dashboard.html` 作为主系统页面。
- 统一使用 Tailwind CDN，移除外部 CSS 文件依赖。
- 所有组件统一放置在 `components/` 目录下，使用标准化命名（`modal_*`、`dropdown_*`、`card_*`、`*_panel`）。

#### 路径统一（v0.3.5 补充）
- 修复注册弹窗模块脚本导入：`modal_signup.html` 的 `type="module"` 使用 `../js/auth.js`（相对 `components/` 目录），避免被解析为 `components/js/auth.js` 导致 404 与 `net::ERR_ABORTED`。
- 统一规则：所有组件内联模块脚本的导入路径必须以组件目录为基准使用相对路径（如 `../js/auth.js`、`../js/language.js`）。
- 保持 `js/main.js` 的 `loadComponent()` 可执行组件内联脚本与 `type="module"`，确保加载后逻辑生效。

#### 样式策略
- 移除所有 `@apply` 规则，避免 Tailwind CDN 模式下的样式失效。
- 所有样式使用内联 class 定义，必要时辅以原生 CSS；统一视觉风格，避免样式冲突与重复定义。

#### 交互优化
- 修复 Modal 组件默认显示问题，确保所有弹窗默认 `hidden`。
- 优化用户系统组件加载顺序，避免页面元素重叠；确保遮罩层与关闭逻辑行为正确。
- 改善整体用户体验与页面响应性（加载后不闪烁、不堆叠）。

#### 验证结果
- 页面加载正常，无控制台错误与 404。
- 所有用户系统组件（下拉、欢迎卡、资料、设置、登录、注册）正确加载与显示。
- 模态框默认隐藏，打开/关闭交互逻辑正常；遮罩层与层级显示正确。
- Tailwind 样式在各组件中正确应用，呈现一致的视觉与交互体验。
