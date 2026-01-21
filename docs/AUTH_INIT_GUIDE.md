
## Auth 初始化单一入口约定

为避免 `onAuthStateChange` 事件被多次注册导致重复提示（如登录后弹出两次“欢迎回来”），项目遵循以下初始化约定：

1.  **单例保护**：`js/features/auth_ui.js` 的 `initAuthUI` 内部已实现 `window.__AUTH_UI_INIT__` 检查，防止同一页面多次调用。
2.  **页面分工**：
    *   `index.html`（入口页）：由 `js/main.js` 负责调用 `initAuthUI('global')`，并可按需挂载登录弹窗 `public/components/modal_login.html`。
    *   `login.html` / `register.html`（可选）：由页面脚本调用 `initAuthUI('login'|'register')`；若使用弹窗，则无需独立页面。
    *   `dashboard.html`：由 `js/dashboard_init.js` 负责初始化与访问守卫。

### 开发者注意
*   弹窗集成：在注入 `public/components/modal_login.html` 后，确保元素 id 与合同一致（`#login-form`、`#btn-login`、`#forgotPwdLink`、`#resendVerifyLink`、`#btn-google-login`）。
*   若新增页面需要 Auth 功能，请在 `js/main.js` 的排除列表中检查，或直接在页面内调用 `initAuthUI`（单例保护会处理冲突）。
*   调试时可检查控制台日志 `[AuthUI] init mode=...` 确认初始化状态。
