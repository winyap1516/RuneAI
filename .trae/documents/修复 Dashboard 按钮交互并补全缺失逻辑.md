## 现状排查与定位
- 入口与初始化：`js/main.js:2-13` 调用 `initDashboard(user)`，页面为 `dashboard.html:365-367`。
- 已实现交互：
  - 侧栏折叠：`js/features/dashboard.js:8-14` 绑定 `#sidebarToggle` 切换 `.aside-collapsed`。
  - 分组折叠：`js/features/dashboard.js:24-35` 对 `#linksGroupHeader/#aiGroupHeader/#userGroupHeader` 使用 `slideToggle`。
  - 菜单高亮：`js/features/dashboard.js:38-45` 仅高亮 `.nav-item`。
- DOM 工具：`js/utils/dom.js` 已有 `$(7-8)`、`slideToggle(43-51)` 与 `mountHTML(62-66)`；缺少通用事件/模态工具函数。
- 未绑定或缺失动作的按钮（HTML 实体存在但没反应）：
  - `dashboard.html:178` `#logoBtn` 无点击逻辑。
  - `dashboard.html:195` `#addCategoryBtn` 无点击逻辑。
  - `dashboard.html:205-213` `#navDigest/#navChat` 仅高亮无视图动作。
  - `dashboard.html:223-225` `#navSettings` 空内容无逻辑。
  - `dashboard.html:251-254` `#addLinkBtn` 无点击逻辑。
  - `dashboard.html:256-257` 顶栏通知按钮无逻辑。
  - `dashboard.html:246` `#searchInput` 无事件绑定。
  - 模态控件：`#addLinkModal`、`#editLinkModal`、`#addCategoryModal`、`#confirmModal` 内的关闭与提交按钮均未绑定。
  - 用户头像下拉：`js/features/dashboard.js:72-78` 插入头像但缺少展开/收起逻辑。

## 目标
- 为上述按钮与控件补齐点击/输入交互，统一模态开关与路由占位视图，保证“点击有响应、流程可闭环”。

## 技术实现
### 1) 增补 DOM 工具（保持现有风格）
- 在 `js/utils/dom.js` 新增：
  - `on(el, type, handler)` 与 `delegate(container, selector, type, handler)` 用于事件绑定与事件委托。
  - `show(el)`/`hide(el)`/`toggle(el)` 统一显示隐藏。
  - `openModal(modalEl)`/`closeModal(modalEl)` 控制模态显示（切换 `hidden`/`show` 类，处理 Backdrop 点击与 Esc 关闭）。
- 保持纯原生实现，不引入第三方库；为每个函数写详细中文注释。

### 2) 补齐 Dashboard 交互（集中于 `js/features/dashboard.js`）
- `#logoBtn`：点击返回首页或重置主视图（默认跳转 `index.html`）。
- `#addLinkBtn`：打开 `#addLinkModal`；绑定 `#cancelAddLinkBtn/#closeModalX/#addLinkBackdrop` 关闭；`#saveLinkBtn` 进行基本校验（URL 非空），演示性地将新卡片追加到 `#cardsContainer`。
- `#addCategoryBtn`：打开 `#addCategoryModal`；绑定保存与关闭按钮；演示性地向 `#linksGroupList` 增加一行分类项。
- 顶栏通知按钮：打开一个临时通知面板（纯前端占位），支持点击外部关闭。
- `#searchInput`：绑定 `input` 与 `keydown`（Enter）事件，在前端对 `#cardsContainer` 里的卡片按标题/描述进行筛选；无数据时显示“空状态”。
- 导航项：
  - `#navDigest`：在主内容区通过 `mountHTML` 渲染 Digest 占位视图（含返回 All Links 的按钮）。
  - `#navChat`：渲染 Chat 占位视图（输入框与对话列表占位）。
  - `#navSettings`：打开 `#settingsModalContainer` 下的设置弹窗占位（或直接在主区渲染设置视图）。
- 用户头像下拉：在 `#userDropdownContainer` 注入下拉菜单节点（`user-dropdown`），点击头像切换 `.show`；点击外部或按 Esc 关闭。
- 通用确认模态：封装一个 `openConfirm({title,message,onOk})`，复用 `#confirmModal` 的 `#confirmCancel/#confirmOk`。
- 所有新增逻辑均以中文详细注释，遵循现有选择器与工具函数风格。

### 3) 结构与样式不做重构
- 不新建页面与路由，仅使用现有容器切换内容。
- Tailwind 样式沿用；不引入新 CSS 文件。

## 验证与自测
- 启动当前开发服务后逐一点击验证：侧栏折叠、分组折叠、各导航项、模态开关、搜索筛选、头像下拉、通知面板与确认模态。
- 在 `#cardsContainer` 注入 2-3 条示例卡片，用于验证添加与筛选流程。

## 交付说明
- 仅修改 `js/utils/dom.js` 与 `js/features/dashboard.js`，不创建新文件。
- 代码内全部使用中文注释，并为关键交互点添加简短说明。
- 保持现有 API 与依赖为空（未来对接后端/Supabase 时，可替换占位实现）。

## 下一步
- 若确认方案，开始补齐上述工具与交互，并进行端到端验证；完成后提供变更清单与使用说明（中文）。