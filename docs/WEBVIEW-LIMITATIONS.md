# 开发环境兼容性与 WebView 限制说明

## 🚨 核心警告：禁止使用 IDE 内置浏览器
本项目 **严禁** 使用 IDE（如 VS Code、Trae、Cursor）自带的 WebView / Preview 窗口进行开发或调试。

### 为什么？
IDE 内置浏览器通常运行在受限的沙箱环境（Sandbox）中，存在以下致命限制：
1.  **网络阻断**：无法正常连接本地回环地址（`127.0.0.1`），导致无法访问本地运行的 Supabase Edge Functions (`:65421`)。
2.  **脚本执行限制**：部分安全策略会拦截模块化 JS 加载，导致 `supabaseClient.js` 或 `syncAgent.js` 根本不执行。
3.  **Storage 隔离**：`localStorage` / `IndexedDB` 可能由 IDE 托管，导致 Token 无法持久化或在重启 IDE 后丢失，引发反复的 401 错误。
4.  **Service Worker 失效**：Service Worker 的注册与拦截行为在 WebView 中极不稳定，可能导致 Auth Header 丢失。

### 表现症状
如果你在 IDE 预览窗口中运行本项目，可能会遇到：
- 控制台没有任何项目相关的日志（如 `[Supabase]` 或 `[Sync]`）。
- `sync-push` 请求直接报 `net::ERR_CONNECTION_REFUSED` 或 `ERR_ABORTED`。
- 登录成功后刷新页面又变回未登录。
- 无法弹出 OAuth 登录窗口。

---

## ✅ 正确的开发姿势

请务必使用标准的外部浏览器（Chrome / Edge / Firefox / Safari）访问开发服务器。

1.  启动开发服务器：
    ```bash
    npm run dev
    ```
2.  **不要点击** IDE 弹出的 "Open in Preview"。
3.  **手动打开** 浏览器访问：
    ```
    http://localhost:5173
    ```
4.  打开浏览器的开发者工具（F12）进行调试。

---

## 环境检测机制
为了防止误用，项目在 `js/main.js` 中内置了检测脚本（仅开发模式启用）：
- 当检测到 UserAgent 包含 `Code`、`Trae`、`IDE` 等关键字，或窗口宽度异常小时：
- 控制台会输出红色严重警告。
- 页面顶部可能会显示红色 Banner 提示。

## 常见问题排查

### Q: 我已经在外部浏览器打开了，为什么还是 401？
A: 请检查 `docs/AUTH-FALLBACK.md`。在本地开发模式下，我们启用了 Token 兜底策略。请尝试：
1. 登出并重新登录。
2. 按 `Ctrl + Alt + C` 清理站点缓存。
3. 确认 `npx supabase status` 显示 Edge Functions 正在运行。

### Q: 外部浏览器显示 "Network Error"？
A: 检查本地防火墙是否放行了 `65421` (Supabase) 和 `5173` (Vite) 端口。确保没有开启系统级代理拦截了 localhost 请求。
