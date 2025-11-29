# 重名追踪表（v0.3.3 规范）

> 范围：扫描 `js/` 下的全部 `.js` 文件，并解析项目内的 import 与 HTML `<script>` 标签引用，标记“被引用/未引用/仅注释引用”。
> 目标：识别同名但不同目录的文件，消除职责混淆，给出归位建议。

## 结论概览
- 本仓库当前“同名不同目录”的项仅发现：`auth.js`
- 其它文件名（如 `settings_panel.js` / `profile_form.js` / `user_dropdown.js` / `user_welcome_card.js` / `dashboard.js` / `settings.js` / `profile.js`）未出现跨目录重名。
- 发现页面仍存在多脚本入口（如 `dashboard.html` 引入多条 `<script type="module" src="...">`），与“入口唯一”规范冲突，需在后续 D 步骤修正为仅引入 `js/main.js`。

## 重名分组明细

| basename | 所在路径 | 角色判定 | 被引用处 | 处理建议 |
|---|---|---|---|---|
| auth.js | `js/auth.js` | 会话/用户存取、localStorage 持久化、mock 登录注册、资料与设置更新 | 被以下模块/页面引用：<br>- `js/main.js`（动态导入 `./auth.js` 用于认证守卫）<br>- `js/dashboard.js`（`import * as auth from './auth.js'`）<br>- `js/settings.js`（`import * as auth from './auth.js'`）<br>- `js/profile.js`（`import * as auth from './auth.js'`）<br>- `js/features/auth.js`（`import { mockLogin, mockSignup } from '../auth.js'`）<br>- `js/features/user_dropdown.js`（`import { getCurrentUser, logout } from '../auth.js'`）<br>- `js/features/profile_form.js`（`import { getCurrentUser, updateUserProfile } from '../auth.js'`）<br>- `js/features/settings_panel.js`（`import { getCurrentUser, updateUserSettings } from '../auth.js'`）<br>- `js/features/user_welcome_card.js`（`import { getCurrentUser } from '../auth.js'`）<br>- `dashboard.html` 存在 `<script type="module" src="js/auth.js">`（违反入口唯一） | 保留并迁移为 `js/utils/auth.js`（职责：纯逻辑/会话/存储/mock）；统一由 features 层通过 utils 引用。不包含 UI。之后批量修正所有 import。
| auth.js | `js/features/auth.js` | 登录/注册弹窗交互，绑定事件与派发全局登录/注册事件 | 被以下模块引用：<br>- `js/main.js`（`import { initAuthModals } from './features/auth.js'`） | 重命名为 `js/features/auth_ui.js`（职责：纯 UI 交互），并补齐 `export function mount(ctx) {}` / `export function unmount(ctx) {}`。内部改为引用 `js/utils/auth.js` 的 mock 能力。

## 证据与扫描方法
- import 解析（示例命中）：
  - `js/features/user_dropdown.js` → `import { getCurrentUser, logout } from '../auth.js'`
  - `js/dashboard.js` → `import * as auth from './auth.js'`
  - `js/main.js` → 动态导入 `await import('./auth.js')`
- HTML `<script>` 标签：
  - `dashboard.html` 存在多入口脚本：`js/main.js`、`js/auth.js`、`js/profile.js`、`js/settings.js`、`js/dashboard.js`（与“入口唯一”规范冲突）。
- 组件 HTML 中的“import”残留：
  - 部分组件（如 `components/settings_panel.html`）曾出现 `import ...` 文本，当前已声明“移除内联脚本”，后续统一由 features 层挂载。对这类残留，归类为“仅注释/文本引用”，不视为实际入口。

## 下一步建议（按 v0.3.3 框架）
- 职责归位与迁移（B）：
  - `js/auth.js` → `js/utils/auth.js`（保留逻辑，去 UI）。
  - `js/features/auth.js` → `js/features/auth_ui.js`（UI 模块，补齐 `mount/unmount`，内部改为 `import { mockLogin, mockSignup } from '../utils/api.js'` 或 `../utils/auth.js`）。
  - 扫描并批量修正所有 import 为相对路径 utils/features 规范。
- mock 能跑通（C）：
  - 新建 `js/utils/api.js`，实现 `mockLogin/mockSignup/mockList` 等，并在 features 中统一调用。
  - main.js 注册 hash 路由：`#/dashboard`、`#/settings`、`#/profile`、`#/auth`；默认 `#/dashboard`，未登录则跳 `#/auth`。
- HTML 入口统一（D）：
  - `index.html` / `dashboard.html` / `signup.html` 仅保留 `<script type="module" src="js/main.js"></script>`，移除其它脚本标签。
  - 全站资源使用相对路径，避免子路径部署 404。

---
注：本报告仅覆盖“同名不同目录”的重名文件；后续将在 B 步对职责不