# WebBookmark AI Assistant

一个智能网页收藏与追踪系统，让你轻松关注感兴趣的网站而无需每日点开浏览。

## 🌟 项目简介
WebBookmark AI Assistant 是一个网页收藏工具的进化版。
它允许用户保存、分类和管理收藏的网址，并在后续版本中由 AI 自动追踪这些网站的最新动态、新闻与政策更新，生成每日摘要报告。

## 📦 当前版本
**v0.3.11 - Dashboard 纯净化 + 守卫与组件逻辑对齐**
- Dashboard 页面不再显示任何登录/注册元素：登录/注册容器与欢迎卡“未登录”块已移除。
- 入口 `js/main.js` 增加认证守卫：未登录访问 `dashboard.html` 自动重定向到 `index.html`。
- `dropdown_user.html` 在 Dashboard 场景下隐藏 `authButtons`；仅显示已登录头像。
- `card_userinfo.html` 仅渲染已登录用户信息；未登录状态由入口守卫拦截，不再渲染。
- 修复预览执行中断（`SyntaxError`）并统一相对导入路径。

**v0.3.10 - 设置面板数据管理恢复 + 脚本外置与初始化**
- 恢复 Settings 面板的数据管理功能：支持用户数据与收藏系统的导入/导出（JSON），导入时合并并去重，导出统一打包。
- 新增特性模块 `js/features/settings_panel.js`，将 `components/settings_panel.html` 内联脚本完全外置，入口在 `js/main.js` 中统一初始化。
- 修复 Vite `html-proxy` 导致的路径代理问题：移除组件内联 `<script type="module">`，改为入口统一加载与事件绑定，彻底规避 `net::ERR_ABORTED`。
- 规划：后续将 `profile_form.html` 脚本迁移至 `js/features/profile_form.js`，保持组件“仅含 HTML”原则。

**v0.3.9 - 欢迎卡片脚本外置 + 入口统一初始化**
- 欢迎卡片 `components/card_userinfo.html` 移除内联 `<script type="module">`，逻辑迁移至 `js/features/user_welcome_card.js` 并在入口 `js/main.js` 中统一初始化，彻底规避 Vite `html-proxy` 解析导致的路径错误与 `net::ERR_ABORTED`。
- 保持组件“仅含 HTML”规范；对仍保留模块脚本的组件（如 `settings_panel.html`、`profile_form.html`）制定迁移计划，逐步外置为特性模块，入口集中绑定。

**v0.3.8 - 页面职责与加载守卫 + 路径与脚本策略复核**
- 登录/注册容器从 `dashboard.html` 迁移至 `index.html`（登录前页面），符合产品逻辑：Dashboard 为登录后的主画面。
- `js/main.js` 增加加载守卫：仅在容器存在时加载对应组件，兼容多页面结构，避免无效加载与报错。
- 路径策略统一：入口仅引入 `./js/main.js`；由 `main.js` `fetch('./components/*.html')` 挂载组件并做事件绑定；禁止 `/js/...` 绝对路径；推荐 `<base href="./">` 稳定相对解析。
 - 新增特性模块 `js/features/auth.js`，统一登录/注册弹窗初始化与事件绑定；组件不再包含 `<script type="module">` 内联脚本（入口轻、功能分包、相对路径）。
 - 复核结论：`modal_signup.html` 为纯 HTML，不含脚本；`net::ERR_ABORTED ...html-proxy...` 已消除，与 Tailwind CDN 无关。
  - 新增：`js/features/user_dropdown.js` 统一绑定用户下拉菜单交互，移除 `dropdown_user.html` 内联脚本与 `onclick`；通过 `dispatchEvent` 实现跨模块通信。

## 📦 历史版本（新增 v0.3.7）
**v0.3.7（2025-11-07）**
- 新增：`/solo/solo_result_20251107.md` 报告，补充 PRD v0.1 对齐计划（收藏系统、用户系统、三语、导入/导出、Mock AI）。
- 更新：在 `/solo/solo_questions.json` 增加不确定项（导入/导出入口位置、语言包路径策略、Digest 展现形态、自动登出触发条件）。
- 说明：组件 HTML 不含 `<script>`，登录/注册交互迁移至 `js/features/auth.js` 并由 `js/main.js` 初始化；语言模块导出约定明确（默认 `i18n` + 具名 `setLanguage`）。

**为什么这样做**
- 兼容任何部署前缀（子路径/多环境），避免 404。
- 浏览器对 `innerHTML` 注入的 `<script>` 不执行，把逻辑集中在 `main.js` 更可靠。
 - 避免 Vite 开发模式下的 `html-proxy` 对组件内联脚本解析为 `components/js/...` 导致 `net::ERR_ABORTED` / 404。
 - 若组件需要脚本（如 settings/profile 仍保留 `<script type="module">`），统一使用 `../js/...` 相对导入以保证在 `components/` 目录下解析正确。

**v0.3.5 - 组件导入路径与预览验证**
- 修复 `modal_signup.html` 的 `type="module"` 导入路径为 `../js/auth.js`，避免在 Vite 开发预览下被解析为 `components/js/auth.js` 导致 `net::ERR_ABORTED` / 404。
- 验证 `dashboard.html` 组件加载无报错，登录/注册/设置/资料卡片脚本均正常执行。

**v0.3.4 - 组件导入路径修复**
- 修复 Vite 开发预览下组件脚本导入路径：组件位于 `components/`，脚本模块在根 `js/` → 统一使用 `../js/...` 相对路径，避免被解析为 `components/js/...` 导致 `net::ERR_ABORTED` / 404。
- 验证 `dashboard.html` 组件加载无报错，脚本执行与交互正常（Modal 默认隐藏、下拉菜单切换、欢迎卡渲染）。

**v0.3.3 - Dashboard 结构与加载稳定化**
- 完成 `dashboard.html` 主系统页面结构与组件化架构，分离 `index.html`（Landing）与 `dashboard.html`（主系统）。
- 在 `js/main.js` 中实现统一的 `loadComponent` 函数，并增强为执行组件内联脚本与 `type="module"` 脚本，保证组件加载时逻辑生效。
- 统一所有组件加载路径为 `./components/` 相对路径，解决子路径/静态站点下 404 问题。
- 移除外部 CSS 文件依赖，样式全部使用 Tailwind CDN + 内联类名/原生 CSS，避免 `@apply` 在 CDN 模式下失效。
- 修复 Modal 默认显示导致页面重叠的问题；确保 Modal 默认 `hidden` 且关闭逻辑有效；加载顺序稳定。
- 计划：在构建阶段加入静态路径检查脚本、补充最小单测覆盖（auth/language/组件加载）、优化组件加载错误处理与性能。

**v0.3.2 - Dashboard 样式稳定化**
- 移除 `dashboard.html` 中的 Tailwind `@apply` 样式块，改写为原生 CSS，确保 CDN 模式下样式不再失效。
- 明确样式策略：仅保留 Tailwind CDN 与内联类名/原生 CSS，不加载外部 CSS 文件，不使用 `@apply`。
- 预览验证：`dashboard.html` 控制台无报错、无 404；用户系统组件（下拉/模态/欢迎卡）样式正常显示。

**v0.3.1 - 首页与注册页重构**
- 新增独立注册页 `signup.html`，使用 Tailwind CDN 与内联类名；注册成功后跳转 `dashboard.html`。
- 重构 `index.html` 为纯 Landing（导航与按钮跳转到 `dashboard.html` / `signup.html`）。
- 统一页面样式与脚本策略：仅保留 Tailwind CDN；不再加载外部 CSS，避免 `@apply` 在 CDN 模式下失效。
- 预览验证通过：`index.html` / `signup.html` / `dashboard.html` 控制台无报错、无 404。

**v0.3.0 - Dashboard 主页面与组件加载统一**
- 新增 `dashboard.html` 作为主系统页面（`index.html` 作为 Landing）。
- 统一组件路径：所有组件通过 `./components/` 相对路径加载。
- 在 `js/main.js` 增加 `loadComponent`/`initUserComponents`，将组件加载逻辑迁移至主脚本，保证顺序与容器一致。
- 统一 Tailwind：仅使用 CDN，不再加载外部 CSS 文件，避免 `@apply` 在非 JIT 构建下失效。
- Modal 默认隐藏并保持隐藏，避免页面堆叠显示。

**v0.2.9 - 导出兼容与开发服务器修复**
- 修复组件导入导出不一致导致的开发服务器启动失败：
  - `language.js` 增加具名导出 `setLanguage`，与组件 `import { setLanguage }` 对齐；默认导出继续为 `i18n` 单例。
  - `auth.js` 增加别名函数：`mockSignup` / `updateUserProfile` / `updateUserSettings` / `logout`，与组件调用保持一致并返回统一结构。
- 调整 `auth.updateSettings` 写入 `user.settings`，与设置面板读取逻辑一致。
- 服务器现已正常运行：`http://localhost:5173/`。

**v0.2.8 - 入口脚本路径统一与本地模式修正**
- 统一入口脚本位置：`main.js` 移动至 `js/` 目录，统一前端脚本路径。
- 更新 `index.html` 引用为 `js/main.js`，解决路径不一致导致的 404。
- 修正本地模式依赖路径：`js/main.js` 中对 `mockFunctions.js` 的相对路径调整为 `../mockFunctions.js`。
- 保持约定：`auth` 使用命名空间导入（`import * as auth`）、`language.js` 默认导出 `i18n`。

**v0.2.7 - 用户系统前端模块完整实现**
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
- 更新 index.html 集成用户系统组件
- 保持现有 UI 风格一致性
 
### 本次修复（v0.2.7 补充）
- 统一 `auth.js` 的使用方式：改为命名空间导入 `import * as auth from './auth.js'`，并按具名函数调用。
- 统一 `language.js` 的导入为默认导出：`import i18n from './language.js'`。
- 修复 `index.html` 中 `main.js` 的脚本路径为根目录，避免 `net::ERR_ABORTED /js/main.js`。（后续在 v0.2.8 统一为 `js/main.js`）

## 📦 历史版本
**v0.2.5 - 侧栏与 Logo 视觉修复**
- 左侧导航分区：LINKS / AI FEATURES / USER，支持 Accordion 折叠。
- LINKS 组动态渲染所有用户分类，底部新增 “+ New Category” 按钮。
- 悬停柔光效果（soft-hover）与激活项左侧渐变指示条（更易识别当前项）。
- 响应式：窄屏时折叠为图标模式，保留 tooltip 文本提示。
- 侧栏采用 `flex flex-col justify-between` 布局，移除默认 `p-4`（减少顶部空白）。
- LOGO 容器改为居中带分隔线（`py-4 border-b`），折叠时保持居中显示。
- 独立封装侧栏头部与主体（`sidebar-header` / `sidebar-body`），折叠态仅头部居中显示 Logo。
- 顶栏品牌标题已迁移至与搜索框同行，避免与侧栏冲突。
- AI Digest：加入今日新内容的绿色小圆点提示（localStorage 标志位 `digestHasNew`）。
- 保持：本地开发模式 `USE_LOCAL_DB`、Edge Function GET 健康检查、`.env` 环境配置。

**v0.2.3 - 本地开发模式与环境配置**
- 新增本地开发模式 `USE_LOCAL_DB`，允许在无 Supabase 环境下运行：
  - 当为 `true`：禁用所有 Supabase/fetch 调用、所有数据写入 `localStorage`、mock AI 返回内容。
  - 当为 `false`：调用 Supabase Edge Functions、正常同步数据库。
- 在 `supabase/functions/super-endpoint` 增加 GET 健康检查，用于验证 `Deno.env.get("SUPABASE_URL")` 是否可读。
- 初始化并维护本地 `.env` 环境变量文件（根目录），用于 CLI 运行 Edge Functions。

## 🚀 未来规划
| 阶段 | 功能 | 状态 |
|------|------|------|
| v0.3 | Dashboard 结构与加载稳定化（v0.3.3） | ✅ 已完成 |
| 修复 | 组件路径错误导致页面空白塌陷 | ✅ 已完成 |
| 修复 | Tailwind CDN 与 @apply 冲突导致样式失效 | ✅ 已完成 |
| 修复 | Modal 默认显示导致页面重叠 | ✅ 已完成 |
| 架构 | 建立清晰项目结构（分离 Landing 与 Dashboard） | ✅ 已完成 |
| 路径 | 统一所有组件加载路径为 ./components/（解决 404） | ✅ 已完成 |
| v0.2 | Solo 工作流与模板 | ✅ 已完成 |
| v0.2 | 收藏卡可分组与搜索 | ✅ 已完成 |
| v0.2 | 顶部数据管理（导出/导入/云端加载） | ❌ 已移除 |
| v0.2 | 用户系统前端模块（登录/注册/资料/设置） | ✅ 已完成 |
| v0.2 | 导出兼容与服务器稳定性修复 | ✅ 已完成 |
| v0.3 | Dashboard 主页面与组件加载统一 | ✅ 已完成 |
| v0.3.10 | 恢复导入/导出（Settings → 数据管理） | ✅ 已完成 |
| v0.3.7 | Digest 最小入口与 Mock 展现（页/弹窗） | ⏳ 计划中 |
| v0.3.11 | 语言包加载支持部署前缀，词条巡检（≥20） | ⏳ 计划中 |
| v0.3.7 | “记住我 / 自动登出”（空闲检测 + 定时器） | ⏳ 计划中 |
| v0.3 | AI 自动追踪网站更新 | 🧠 规划中 |
| 检查 | 增加静态路径检查脚本（自动验证组件路径） | ⏳ 计划中 |
| 测试 | 为用户系统添加完整测试覆盖 | ⏳ 计划中 |
| 性能 | 优化组件加载性能与错误处理机制 | ⏳ 计划中 |
| v0.4 | 自动生成每日摘要与推荐 | 🔮 规划中 |
| v1.0 | 与 YinGAN OS 系统接轨 | 🌌 概念阶段 |

## ⚙️ 技术说明
- 前端使用纯 HTML + JS + Tailwind
- 与 Supabase 交互通过 Edge Functions：
  - `/functions/v1/super-endpoint` → 新增并生成卡片数据
  - `/functions/v1/delete-link` → 删除数据库记录
  - `/functions/v1/update-link` → 编辑并同步数据库
- 匿名调用，仅保留 `Content-Type: application/json` 请求头
- 移除前端直写数据库逻辑；取消自动缓存同步（保留离线 `cacheToLocal`）

## 🛠️ 使用方式
1. 运行 `npm run dev` 启动开发服务器（固定 `http://localhost:5173/`）。
2. 在顶部点击 `Add Link`，输入网址保存卡片。
3. 通过卡片右上角菜单进行 `Edit` / `Delete` 操作。
4. 侧边栏使用分类筛选；顶部搜索框支持实时过滤。

## 🧪 验证与测试
- 启动应固定为 `http://localhost:5173/`。
- 页面刷新后收藏卡仍能从 `localStorage` 正常加载。
- 新增时若输入 `www.openai.com` 与 `openai.com`，系统会提示去重并阻止重复。

## 🧰 开发模式切换
- 在 `main.js` 顶部定义：
  ```js
  const USE_LOCAL_DB = true; // 本地模式：仅使用 localStorage 与 mock AI
  // const USE_LOCAL_DB = false; // 生产模式：调用 Supabase Edge Functions
  ```
- 当为 `true`：
  - 所有保存/编辑/删除操作仅本地持久化；
  - AI 内容通过 `mockFunctions.js` 返回；
  - Function 测试按钮走本地 mock。
- 当为 `false`：
  - 调用 `super-endpoint` / `delete-link` / `update-link`，与数据库同步。

## 🔐 环境变量与部署
- 本地开发需在项目根目录配置 `.env` 文件：
  ```ini
  SUPABASE_URL=your_supabase_project_url
  SUPABASE_ANON_KEY=your_anon_key
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
  OPENAI_API_KEY=your_openai_api_key
  ```
- 每次在 Supabase Dashboard 更新密钥或新增变量，请同步更新 `.env`。
- `.env` 已加入 `.gitignore`，不要上传到云端或 GitHub。
- 部署时使用 Supabase CLI，将自动使用 Dashboard 已配置的环境变量。
- 开发本地函数需安装 Docker Desktop（Windows/macOS），CLI 依赖本地 Docker。

## 🧪 Edge Function 健康检查
- 本地验证：
  - 在项目根目录执行：
    ```bash
    npx supabase functions serve super-endpoint
    ```
  - 访问：`GET http://localhost:54321/functions/v1/super-endpoint`
  - 期望返回：`{"ok": true, "env_has_supabase_url": true}`（取决于本地 `.env` 是否配置）。

## 📄 许可协议
MIT License © 2025 小葱 & GPT哥
