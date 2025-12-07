## 项目现状概览
- 前端：`HTML + 原生 JS + Tailwind`，主要页面 `dashboard.html`，核心交互在 `js/features/dashboard.js`，已包含卡片渲染、搜索、模态与分类维护。
- 构建：`Vite`，本地开发已可运行。
- 后端：`Supabase Edge Functions (Deno)`，已有 `super-endpoint`（调用 OpenAI 生成摘要/分类并入库）、`update-link`、`delete-link`。
- 存储：本地 `localStorage`（`rune_cards`、`rune_categories`）+ 云端 `Supabase Postgres (links)`；本地开发用 `mockFunctions.js` 生成模拟 AI 结果。

## 目标功能
- 输入网址后自动抓取/生成标题、摘要、分类、标签，生成卡片。
- 卡片可编辑（标题、摘要、分类、标签等）与删除。
- 分类与标签可筛选与维护；支持本地与云端两种模式切换。

## 前端实现（在既有文件内增量改造）
- URL 输入与校验：在 `dashboard.html` 保持现有输入区，使用 `js/features/dashboard.js` 扩展校验（去重、规范化 `http/https`）。
- AI 调用与结果展示：
  - 默认走本地开发：调用 `mockFunctions.js::mockAIFromUrl(url)` 返回 `{ title, description, category, tags }` 并立即渲染。
  - 云端模式：新增一个轻量封装（不引入新文件，直接在 `dashboard.js` 内）调用 Supabase Edge Function `POST /functions/v1/super-endpoint`，解析返回 JSON 并渲染。
  - 失败回退：云端失败自动回退到本地 `mockAIFromUrl`，保证体验。
- 卡片数据结构：统一 `{ id, url, title, description, category, tags, created_at, updated_at }`；本地使用 `id: Date.now()` 或 `crypto.randomUUID()`，云端由数据库生成。
- 卡片渲染与筛选：
  - 扩展现有卡片模板，显示 `title/description/tags/category`；保留已有搜索与分类筛选逻辑，补充标签筛选（轻量本地实现）。
  - 分类维护：保持 `dashboard.js` 现有分类新增/选择行为，确保 `localStorage.rune_categories` 与云端数据一致。
- 编辑与删除（CRUD）：
  - 编辑：弹窗或行内编辑，更新本地存储；云端模式下同时调用 `update-link`。
  - 删除：本地移除并刷新；云端模式调用 `delete-link` 按 `url` 删除。
  - 乐观更新：先更新 UI，失败再回滚并提示。
- 模式切换：在 `dashboard.js` 内根据是否配置 `SUPABASE_URL/ANON_KEY` 自动判断，提供一个开关变量（如 `useCloud`）。
- 交互细节：
  - 提供“重新生成摘要”入口（复用 `components/modal_digest.html`），可选择覆盖或追加。
  - 错误提示与加载状态（按钮禁用、骨架屏）。
  - 国际化字符串沿用现有 `languages/*.json`，必要时补充键值。

## 后端增强（在现有 Edge Functions 轻改）
- `super-endpoint`：
  - 请求：`POST { url }`，可选 `forceRefresh`。
  - 响应：标准 `{ url, title, description, category, tags, created_at }`；统一错误码与消息。
  - OpenAI：`gpt-4o-mini`，提示词要求严格 JSON；加入超时与重试（指数退避）。
- `update-link`/`delete-link`：
  - 入参对齐前端字段；保证 CORS 预检与错误返回一致。
- 权限与密钥：前端仅使用 `anon key`；服务端持有 `service_role_key`，不泄露到客户端。

## 存储与同步策略
- 本地模式：所有数据仅写入 `localStorage`，分类随写随增；同一 `url` 去重。
- 云端模式：
  - 新增：先调用云端入库，再更新前端缓存（可同步到 `localStorage` 以做离线缓存）。
  - 编辑/删除：云端成功后同步更新本地缓存。
  - 启动时：拉取云端 `links` 列表一次性填充前端数据（必要时分页）。

## 安全与配置
- 环境变量：`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`OPENAI_API_KEY`；仅在 Edge Functions 使用敏感密钥。
- CORS：所有函数支持 `OPTIONS` 预检与允许来源；限制可接受域名（本地与生产）。
- 输入清洗：`url` 规范化、去脚本注入；前端不展示未转义 HTML。

## 验证与测试
- 单元测试：对 `dashboard.js` 中的归一化、去重、分类合并逻辑做测试（如以 `vitest`）。
- 集成测试：本地模式（mock）与云端模式（Edge Function）分别验证新增、编辑、删除、筛选。
- 手动验证：启用本地预览，确认卡片渲染、分类/标签筛选与摘要重生成流程。

## 交付与可选增强
- 标签管理：批量编辑标签、热门标签建议。
- 视觉增强：自动抓取 Favicon（由后端补充）、截图缩略图（可后期接入 Puppeteer/Playwright 截屏逻辑）。
- 排序与分组：按 `created_at`、按分类/标签分组视图；拖拽排序。

---
请确认以上方案。确认后我将开始在现有文件内按约定增量改造，所有新增/修改代码都会提供详细中文注释，并在实现过程中完成端到端验证。