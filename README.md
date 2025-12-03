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

本项目已完成 Phase 5 的基础体验整合与重构：入口 → 登录/注册（独立页）→ SDK Auth → Sync → Dashboard。

### 用户体验流（入口 → Auth Flow → Sync Flow）
- 首页入口：`index.html` 提供“登录 / 注册”按钮，跳转到 `login.html`。
- 登录流程：`login.html` 负责用户认证，支持 Google 登录（UI 预留）；登录成功后自动跳转 `dashboard.html`。
- 注册流程：`register.html` 负责新用户注册，注册后引导用户验证邮箱或登录。
- 访问控制：`dashboard.html` 加载时强制检查 Session，未登录自动重定向至 `login.html`。
- 自动同步：登录成功或 Dashboard 初始化时，调用 `linkController.initSyncAfterLogin()`，触发本地→云端迁移与同步。

### 技术整合
- Supabase SDK：`js/services/supabaseClient.js` 统一初始化与会话获取。
- Auth 逻辑重构：`js/features/auth_ui.js` 支持 `mode` 参数（login/register/global），实现逻辑复用与分离。
- 页面初始化：`js/dashboard_init.js` 接管 Dashboard 的 Session 检查与初始化逻辑。
- 云端操作迁移：所有数据操作已迁移至 SDK 直接调用（links 表与 Edge Function）。

## 手动测试步骤
1. 启动开发服务器：`npm run dev`，打开 `http://localhost:5173`。
2. 打开首页（Landing）：点击“登录 / 注册”进入 `login.html`。
3. 登录：输入邮箱密码 → 成功 → 自动跳转 Dashboard → 控制台显示同步触发。
4. 注册：点击“注册一个” → 进入 `register.html` → 注册成功 → 提示验证或跳转。
5. 访问控制：手动登出 → 访问 `dashboard.html` → 应自动跳回 `login.html`。

## 开源协议

MIT License
