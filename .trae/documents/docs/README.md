# RuneAI / YinGAN — 前端运行与认证指南

> ⚠️ **开发环境警告**：  
> 本项目 **禁止** 使用 IDE（VS Code/Trae）内置的 WebView/Preview 进行调试。  
> 内置浏览器的沙箱限制会导致 Supabase 认证与同步功能失效。  
> 请务必使用 **Chrome / Edge** 访问 `http://localhost:5173`。  
> 详见 [WEBVIEW-LIMITATIONS.md](WEBVIEW-LIMITATIONS.md)。

## 快速开始
- 安装依赖：`npm install`
- 启动开发：`npm run dev`，访问 `http://localhost:5173/`
- 构建生产包：`npm run build`

## 环境变量
- `VITE_SUPABASE_URL`：Supabase 项目 URL（如 `https://xxxx.supabase.co` 或本地地址）
- `VITE_SUPABASE_ANON_KEY`：Supabase Anon Key（仅前端可用）
- 启动时由 `js/services/config.js` 的 `config.validate()` 进行校验，缺失将 fail-fast。

## 认证流程（Phase 5）
- 页面入口：`index.html`（可打开登录弹窗 `public/components/modal_login.html`）或独立 `login.html` / `register.html`
- 登录成功：触发 `linkController.initSyncAfterLogin()` 并跳转 `dashboard.html`
- 注册成功：立即 `signOut()`，显示“请查收邮箱验证”提示卡片，用户返回登录入口
- 会话监听：`supabase.auth.onAuthStateChange` 处理 `SIGNED_IN`/`SIGNED_OUT` 事件
- ⚠️ **初始化约定**：遵循单例模式，避免重复绑定。详见 [AUTH_INIT_GUIDE.md](AUTH_INIT_GUIDE.md)。

### 开发环境临时说明（Auth Fallback）
- 在部分 IDE 内置浏览器中，SDK 会话恢复可能失败导致 401。已在开发环境实现受控兜底：从 `localStorage` 读取 Token 并附加到 `Authorization`。
- 详情与迁移计划见 `docs/AUTH-FALLBACK.md`（上线前必须移除 dev-only 逻辑）。

## 安全细则（本次修复）
- 登录/注册按钮使用 `type="button"`，禁止浏览器默认提交，改为 JS 手动触发
- 绑定点击与回车事件，调用 `signInWithPassword` / `signUp` 并显示错误提示
- 页面加载与操作前均清理 URL 中的敏感参数（`password/email/remember`）
- Service Worker 对 HTML 采用 **Network First**，避免旧缓存页面导致交互失效

## 手动验证
1. 在 `index.html` 打开登录弹窗或访问 `login.html`，输入邮箱与密码后点击“登录”或按回车
   - 成功：弹出欢迎提示并跳转 `dashboard.html`
   - 失败：页面内弹出错误提示（无刷新、无 URL 参数暴露）
2. 注册：输入邮箱/密码/确认密码，成功后显示“验证邮件已发送”，并强制登出
3. Dashboard 守卫：未登录访问 `dashboard.html` 会跳转到 `index.html`

## 附：更新文件
- `public/components/modal_login.html`：与 `auth_ui.js` 合同对齐（id/name），新增“忘记密码/重发验证邮件/Google 登录”入口
- `js/features/auth_ui.js`：事件绑定重构、SDK 初始化防护、登录成功兜底跳转
- `sw.js`：HTML Network First
- 文档：`docs/auth_ui_spec.md`、`docs/ARCHITECTURE.md`、`CHANGELOG.md`

## Web Digest（新增模块）
- 生成接口：`/functions/v1/generate-digest`（POST，需 `Authorization: Bearer <JWT>`）
- 历史查询：`/functions/v1/list-digests`（GET，分页与日期筛选）
- 手动入队：`/functions/v1/enqueue-send`（POST，将指定 digest 写入队列）
- Worker：`/functions/v1/send-worker`（由 Supabase Scheduler 每 1 分钟触发）

### 发送历史（新页面与接口）
- 页面路由：`#/send-logs`（登录后可见，未登录跳转登录）
- Edge Function：`/functions/v1/list-send-logs`（GET，支持 `channel/status/date` 筛选，默认返回最近 100 条）
- Retry：在“发送历史”页点击失败记录的 Retry 按钮，调用 `/enqueue-send` 重新入队并刷新列表

### 本地运行与验证
- 设置环境：在 Supabase 项目中配置 `TELEGRAM_BOT_TOKEN`（仅服务端持有）
- 生成 Digest：在 Dashboard → Digest 页面点击 `Generate (Edge)` 按钮
- 手动发送：在 Digest 卡片点击 `Send Now` 入队；等待 Worker 执行
- 查看日志：打开发送历史页（`js/views/sendLogsView.js` 集成到仪表盘），或直接查询 `send_logs`

### 队列与重试
- 队列表：`public.send_queue`（状态与指数退避）
- 日志表：`public.send_logs`（成功/失败与响应记录）
- 重试：日志页点击 `Retry` 重新 `enqueue-send`

## 测试与可测试性（新增说明）
- 单元测试运行：`npx vitest run`
- `aiService` 测试：通过被测模块提供的测试钩子 `__setTestHooks` 注入模拟函数，避免路径差异导致的 `vi.mock` 失效。
- `digestController` 测试：指定 `/* @vitest-environment jsdom */` 并在导入前执行 `vi.mock`，避免触发真实 `IndexedDB` 迁移与 `localStorage` 警告。
- 云端调用隔离：在 Node/Vitest 环境下禁用 `ai.js` 的云端回落，确保断言不受 Supabase Edge Function 干扰。
## UI 变更（2025-12-08）
- 将页面右上角全局 `Add Link` 按钮移至 **All Links** 区域并替代标题，保留旧按钮 DOM 并默认隐藏（类：`global-add-link--hidden`），可快速回滚。
- 在非 `All Links` 分类列表末尾新增“+”卡片（`.rune-card-add`），点击打开 **选择已有链接** 弹窗（`#selectLinkModal`），支持搜索与加入当前分类。
- 抽取 `openAddLinkModal()` 到 `src/js/services/uiService.js`，统一模态框打开逻辑与焦点管理。
- 无障碍：新按钮设置 `aria-label="Add Link"`，小屏仅显示图标确保不遮挡搜索栏。

### 开发者操作要点
- 绑定：`views/linksView.bindModalEvents()` 绑定 `#addLinkBtnHeader` 与 `#addLinkBtn` → 复用 `uiService.openAddLinkModal()`。
- 分类筛选：`views/linksView.filterCardsByCategory(name)` 将在末尾插入“+”卡片；添加后会自动恢复当前分类视图。
- 选择弹窗：`views/linksView.bindSelectLinkModalEvents()` 负责渲染 `#selectLinkModal` 列表与搜索，调用 `linkController.updateLink(id, { category })` 加入分类。
