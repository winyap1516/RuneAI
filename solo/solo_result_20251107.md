# Solo 报告｜PRD v0.1 差距分析与迭代计划（2025-11-07）

## 概览
- 当前版本：v0.3.6（本地预览稳定，已消除 `net::ERR_ABORTED`）
- 架构策略：组件 HTML 不含内联脚本，统一在 `js/main.js` 与特性模块初始化（如 `js/features/auth.js`）
- 多语言：`language.js`（默认导出 `i18n` + 具名 `setLanguage`），词包位于 `/languages/zh.json|en.json|ms.json`，页面通过 `data-i18n` 绑定
- 用户系统：登录/注册/登出、资料与偏好（语言/主题/AI 风格），基于 `localStorage` 持久化
- 收藏系统：`linkData` + `categories`，支持新增/编辑/删除/分类/搜索、去重与刷新持久化

## PRD v0.1 对比矩阵（现状 vs 目标）
- 收藏系统（网页/地点）
  - 已实现：新增（Add Link 弹窗）、编辑、删除、分类管理（侧栏 LINKS 组）、标签、搜索、去重（域名键）、刷新后持久化
  - 缺失：导出/导入 JSON（v0.2.2 曾移除顶部“数据管理”；PRD v0.1 要求需恢复，建议迁移到 Settings → 数据管理分区）
- Dashboard
  - 已实现：卡片列表渲染、侧边栏分类、搜索框、顶部欢迎区（用户面板）、右上角用户菜单（Profile/Settings/Logout）
  - 待补：AI Digest 入口页（现有侧栏条目与绿色指示点，但缺少实际 Digest 页面/弹窗与 Mock 结果展现）
- 用户系统（外壳）
  - 已实现：登录/注册/登出、本地用户信息与偏好；Profile/Settings 模态与交互
  - 需要核验：`autoLogout` 行为与“记住我”的具体策略是否与 PRD一致（目前有设置项与提示，需补充定时器与空闲检测）
- 多语言（三语 ≥ 20 词条）
  - 已实现：`language.js` + `/languages/*.json`，大量组件使用 `data-i18n`；词条覆盖较广
  - 潜在问题：`fetch('/languages/...')` 为绝对路径，子路径部署可能失效；建议支持部署前缀或使用相对/基路径策略
- Mock AI 入口
  - 已实现（基础）：`mockFunctions.js` + `main.js` 内调用模拟生成与 Supabase Functions 桩（`super-endpoint`）
  - 待补（v0.2 范畴）：Plan Trip / Daily Digest 两按钮与模板化结果卡片保存为“符文卡片”

## 迭代任务清单与时间估算（工作量为净时）
1) 还原并完善导入/导出（linkData/categories）（v0.1 必达）
   - 在 Settings → 数据管理新增“导出/导入”区块（JSON 文件）
   - 导出：合并 `linkData`/`categories`（可扩展 `runes`/`kbFiles` 但标注 v0.3）
   - 导入：解析 JSON → 合并去重（主键/域名键）→ 回写本地并刷新侧栏
   - 预计：后端无，前端 UI + 逻辑 6–8 小时；含基础错误提示与成功 toast

2) AI Digest 入口与 Mock 展现（v0.2，先给最小可用）
   - 在侧栏点击进入 Digest 页或弹窗，读取当前筛选集，调用 `mockFunctions.js` 返回模板化摘要
   - 提供“保存为符文卡片”占位按钮（落到 `localStorage.runes`）
   - 预计：最小页/弹窗 + 模板渲染 6–10 小时；符文保存 3–4 小时（v0.3 可扩）

3) 多语言健壮性与词条排查（v0.1）
   - 支持部署前缀：语言包加载改为相对/基路径策略；新增加载失败兜底提示
   - 词条补齐：统一 key 使用、检查 ≥20 覆盖到所有关键按钮与提示
   - 预计：路径与兜底 2–3 小时；词条巡检与补齐 3–5 小时

4) 用户系统“记住我 / 自动登出”（v0.1）
   - 记住我：登录后延长本地会话有效期（持久键）
   - 自动登出：空闲计时器 + UI 提示（配置 `autoLogoutMinutes`）
   - 预计：前端计时与事件绑定 3–5 小时

5) 文档与 CI 校验
   - 文档：README/CHANGELOG/blueprint 对齐 PRD v0.1 状态与新增任务
   - CI 校验：扫描组件脚本导入路径与 `data-i18n` 覆盖（脚本原型）
   - 预计：文档 1–2 小时；校验脚本雏形 2–3 小时

## 风险与不确定点
- 是否在 v0.1 恢复“导入/导出”入口（建议：放在 Settings → 数据管理，不回摆到顶部导航）
- 语言包加载路径策略（绝对 vs 相对/基路径），需确认部署前缀方案
- AI Digest 形态（独立页 vs 弹窗）的交互与保存位置（符文卡片）
- `autoLogout` 的触发条件（纯时间到达 vs 用户空闲检测）

## 建议
- 先打通 v0.1 的导入/导出与多语言健壮性；AI Digest 给最小可用入口与 Mock 展现，符文保存留到 v0.3 完整化
- 将语言包路径与组件导入统一相对策略，避免子路径部署问题
- 在后续迭代中为 `auth`/`language` 增加最小单元测试，防止导入回归

## 产出与记录
- 本报告：`/solo/solo_result_20251107.md`
- 提问记录：见 `/solo/solo_questions.json`（新增多项不确定点）
- 文档更新：CHANGELOG / README / blueprint 已追加本次评审与任务计划