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
- 页面入口：`index.html` → `login.html` / `register.html`
- 登录成功：触发 `linkController.initSyncAfterLogin()` 并跳转 `dashboard.html`
- 注册成功：立即 `signOut()`，显示“请查收邮箱验证”提示卡片，用户返回登录页
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
1. 打开 `login.html`，输入邮箱与密码后点击“登录”或按回车
   - 成功：弹出欢迎提示并跳转 `dashboard.html`
   - 失败：页面内弹出错误提示（无刷新、无 URL 参数暴露）
2. 注册：输入邮箱/密码/确认密码，成功后显示“验证邮件已发送”，并强制登出
3. Dashboard 守卫：未登录访问 `dashboard.html` 会跳转到 `login.html`

## 附：更新文件
- `login.html` / `register.html`：按钮类型与初始化脚本
- `js/features/auth_ui.js`：事件绑定重构、SDK 初始化防护、登录成功兜底跳转
- `sw.js`：HTML Network First
- 文档：`docs/auth_ui_spec.md`、`docs/ARCHITECTURE.md`、`CHANGELOG.md`

