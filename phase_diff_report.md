# 跨阶段差异分析报告 (Cross-Phase Difference Report)

## 1. 总体状态概览

通过对比 `PHASE3_PLAN.md`、`PHASE5_PLAN.md` 和 `ROADMAP.md`，结合 `MODULE_SPLIT.md` 和 `ARCHITECTURE.md` 的现状，得出以下结论：

*   **Phase 0-2 (Roadmap)**: 属于早期的渐进式规划，实际上已被 **Phase 4 (Cloud Sync)** 的“一步到位”实施所取代。Roadmap 中的 Phase 2 "Cloud Integration" 实际上就是在 Phase 4 完成的。
*   **Phase 3**: 性能优化阶段，Roadmap 标记为 **DONE**。`PHASE3_PLAN.md` 是该阶段的详细执行方案，目前作为历史参考保留，但其任务已完成。
*   **Phase 4**: 云端同步架构重构，已完成。文档中缺乏独立的 `PHASE4_PLAN.md`，但 `ROADMAP.md` 和 `MODULE_SPLIT.md` 确认了其完成状态。
*   **Phase 5**: 当前进行中阶段。`PHASE5_PLAN.md` 与 `ROADMAP.md` 中的 Phase 5 定义高度一致。

## 2. 差异点详情

### 差异点 001: Phase 2 与 Phase 4 的重叠
*   **文件来源**: `ROADMAP.md`
*   **差异说明**: Roadmap 中 Phase 2 定义为 "Cloud Integration" (Supabase 接入)，而 Phase 4 定义为 "Cloud Sync" (同步架构)。实际上，Phase 4 的实施包含了 Phase 2 的所有基础设施工作（DB, Auth, Edge Functions）。
*   **正确状态**: 以 Phase 4 的实际产出为准。Phase 2 可视为“已合并入 Phase 4”。
*   **建议修复**: 在 Master Plan 中明确 Phase 4 包含了基础设施建设。

### 差异点 002: PWA 任务的归属
*   **文件来源**: `ROADMAP.md` vs `PHASE3_PLAN.md`
*   **差异说明**: `ROADMAP.md` Phase 3 提到 "Service Worker ... [Defer to Phase 5]"。`PHASE3_PLAN.md` 未详细列出 PWA 任务。`PHASE5_PLAN.md` 明确包含 PWA。
*   **正确状态**: PWA 属于 Phase 5。
*   **建议修复**: 确认 PWA 为 Phase 5 的 Milestone 5.3 (P2 优先级)。

### 差异点 003: 冲突处理的状态
*   **文件来源**: `ROADMAP.md` (Phase 4) vs `PHASE5_PLAN.md`
*   **差异说明**: Roadmap Phase 4 声称 "冲突检测 UI 占位" 已完成。但 Phase 5 又要求 "创建 modal-conflict.js"。
*   **正确状态**: 后端/逻辑层的冲突检测 (`conflicts` 数组返回) 已在 Phase 4 完成。前端的用户界面 (UI Modal) 尚未实现。
*   **建议修复**: 明确 Phase 5 的任务是 "冲突解决 UI 的实现与接入"，而非底层的冲突检测逻辑。

### 差异点 004: Auth SDK 的引入
*   **文件来源**: `docs/TECH_DECISIONS.md` vs `PHASE5_PLAN.md`
*   **差异说明**: 旧文档 (Tech Decisions) 可能还主张不引入框架/库。Phase 5 明确决策引入 `@supabase/supabase-js`。
*   **正确状态**: Phase 5 的决策覆盖旧决策。
*   **建议修复**: 更新 Master Plan 确认 SDK 的引入是 P0 级任务。

## 3. 任务状态核对表

| Phase | 项目 | 状态 | 说明 |
| :--- | :--- | :--- | :--- |
| **Phase 3** | Partial Update | **DONE** | Roadmap 确认 |
| **Phase 3** | Virtual Scrolling | **DONE** | Roadmap 确认 |
| **Phase 3** | Pagination | **DONE** | Roadmap 确认 |
| **Phase 4** | Supabase Infra | **DONE** | 包含 DB, Auth, Edge Functions |
| **Phase 4** | Sync Agent / RPC | **DONE** | 代码库中存在且已部署 |
| **Phase 4** | RLS Policies | **DONE** | 代码库中存在 |
| **Phase 5** | Auth UI / SDK | **TODO** | P0 优先级，待开始 |
| **Phase 5** | Conflict UI | **TODO** | P1 优先级，待开始 |
| **Phase 5** | PWA / Offline | **TODO** | P2 优先级，待开始 |
