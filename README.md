# RuneAI

一个用于收藏网页跟AI小助理网页

## 项目简介

RuneAI 是一个现代化的网页收藏和AI助理工具，帮助用户高效管理和利用网络资源。

## 主要功能

- 🔖 智能网页收藏管理
- 🤖 AI驱动的内容分析和推荐
- 📱 响应式设计，支持多设备
- ⚡ 高性能虚拟滚动技术
- 🔍 智能搜索和分类

## 技术栈

- 前端：HTML5, CSS3, JavaScript (ES6+)
- 构建工具：现代构建系统
- 部署：GitHub Pages

## 最近更新（Phase 5）

本项目已完成 Phase 5 的基础体验整合：入口 → 登录 → SDK Auth → Sync → Dashboard。

### 用户体验流（入口 → Auth Flow → Sync Flow）
- 首页入口：在 `index.html` 添加“登录 / 注册”按钮，跳转到 `auth.html`。
- Auth 页面：`auth.html` 提供登录与注册表单，使用 Supabase SDK 执行认证。
- 登录成功：调用 `linkController.initSyncAfterLogin()`，触发本地→云端迁移与同步循环。
- 自动跳转：认证成功后自动跳转到 `dashboard.html` 展示数据。

### 技术整合
- Supabase SDK：`js/services/supabaseClient.js` 统一初始化与会话获取（`getSession` / `getUser`）。
- Auth 逻辑：`js/features/auth_ui.js` 绑定登录/注册/登出，并监听 `auth.onAuthStateChange`。
- 同步触发：`js/controllers/linkController.js` 暴露 `initSyncAfterLogin()`，并改造云端操作为 SDK 调用。

## 手动测试步骤
1. 启动开发服务器：`npm run dev`，打开 `http://localhost:5173`。
2. 打开首页（Landing）：点击“登录 / 注册”进入 `auth.html`。
3. 在登录或注册表单中提交邮箱与密码。
4. 登录成功后，系统会触发同步（控制台可见日志），并自动跳转到 `dashboard.html`。
5. 在 Dashboard 中验证数据展示与用户状态（头像/昵称）。

## 开源协议

MIT License
