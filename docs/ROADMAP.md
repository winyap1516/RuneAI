# 项目路线图 (Project Roadmap)

## Phase 0: 本地稳定与规范化 (Local Stability) - **当前阶段**
**目标**: 确保单机版功能完备，无明显 Bug，代码结构清晰。

*   **Milestone 0.1: 核心体验修复** (✅ 已完成)
    *   [x] 修复 ID 类型兼容性问题。
    *   [x] 持久化 Cooldown 状态。
    *   [x] 明确区分 Manual/Daily 生成逻辑。
    *   [x] 提取全局常量配置。
*   **Milestone 0.2: 架构重构** (进行中)
    *   [ ] **P2** 消除 Dashboard 重复摘要逻辑 (移至 Service)。
    *   [ ] **P2** 拆分 `dashboard.js` 为 MVC 结构。
    *   [ ] **P3** 引入 ESLint/Prettier 规范代码风格。

## Phase 1: 本地后端模拟 (Local Backend Simulation)
**目标**: 在不连接真实云端的情况下，通过完善的 Mock 层模拟后端行为，为云端迁移做准备。

*   **Milestone 1.1: 增强型 Service 层**
    *   [ ] 完善 `ai.js`: 支持错误注入、网络延迟模拟。
    *   [ ] 完善 `scheduler.js`: 实现基于 `requestIdleCallback` 或 Web Worker 的本地定时任务。
*   **Milestone 1.2: 数据层抽象**
    *   [ ] 确保 `storageAdapter` 的所有方法均返回 Promise，且接口签名与 Supabase SDK 保持一致。

## Phase 2: 云端化迁移 (Cloud Integration)
**目标**: 接入 Supabase，实现多端同步与真实 AI 能力。

*   **Milestone 2.1: 基础设施接入**
    *   [ ] 配置 Supabase Project (Auth, DB, Edge Functions)。
    *   [ ] 实现 `MIGRATION_PLAN.md` 中的数据迁移脚本 (IndexedDB -> Postgres)。
*   **Milestone 2.2: 认证与鉴权**
    *   [ ] 集成 Supabase Auth (GitHub/Google Login)。
    *   [ ] 启用 RLS (Row Level Security) 保护用户数据。
*   **Milestone 2.3: AI 服务上云**
    *   [ ] 部署 Edge Functions 处理网页抓取与 OpenAI 调用。
    *   [ ] 移除前端的 Mock AI 逻辑（或保留为离线模式）。

## Phase 3: 性能与规模化 (Optimization & Scale)
**目标**: 支持 1000+ 链接流畅运行，优化首屏体验。

*   **Milestone 3.1: 渲染性能**
    *   [ ] 实现列表的**虚拟滚动 (Virtual Scrolling)**。
    *   [ ] 图片/Icon 懒加载。
*   **Milestone 3.2: 数据性能**
    *   [ ] 实现 IndexedDB/API 的**分页查询 (Pagination)**。
    *   [ ] 引入 Service Worker 进行静态资源缓存 (PWA)。

## 验收标准 (Success Metrics)
*   **稳定性**: 关键路径 (Generate, CRUD) 无未捕获异常。
*   **性能**: 500 条链接下，首屏渲染 < 1s，滚动无掉帧。
*   **可维护性**: 单个 JS 文件不超过 400 行。
