# Phase 5 文档审计报告 (Yin-Yang Audit Report)

## 1. 全面文档审查 (Document Audit)

| 文件名 | 章节/模块 | 状态 | 说明 & 更新建议 |
| :--- | :--- | :--- | :--- |
| **README.md** | 全文 | **NEEDS_UPDATE** | 仍停留在 v0.3 纯前端阶段，未提及 Supabase、Docker、Phase 4/5。**建议**：重写，突出 "Local-First + Cloud Sync" 架构，补充启动指南。 |
| **blueprint.md** | 模块规划 | **NEEDS_UPDATE** | 进度严重滞后（标记 Sync 为 v0.2 完成，实际为 Phase 4）。**建议**：更新进度状态，移除过时的 "v0.x" 标记，对齐 Phase 5 目标。 |
| **docs/ARCHITECTURE.md** | 全文 | **NEEDS_UPDATE** | 缺少 Edge Function、RLS、Supabase Auth 的详细描述。**建议**：补充后端架构图与数据流。 |
| **docs/PHASE5_PLAN.md** | 全文 | **DONE** | 当前单一真理来源（SSOT），定义了 Auth SDK、冲突 UI 和 PWA。 |
| **docs/PHASE4_SUMMARY.md** | 全文 | **MISSING** | Phase 4 虽已验证，但缺乏总结文档。**建议**：将 `devops/audit/phase4/phase4_audit_report.md` 提炼为正式文档。 |
| **docs/TECH_DECISIONS.md** | 技术栈 | **NEEDS_UPDATE** | 需补充 "Supabase SDK vs Fetch" 的最终决策（Phase 5 已定案使用 SDK）。 |
| **PHASE4_DEPLOY.md** | 部署步骤 | **DONE** | 描述了 Docker 部署，暂时准确。 |
| **docs/ROADMAP.md** | 时间线 | **NEEDS_UPDATE** | 需确认是否包含 Phase 5 的详细拆解。 |
| **js/services/supabaseClient.js** | 注释/代码 | **NEEDS_UPDATE** | 代码注释明确说 "未引入 SDK"，与 Phase 5 目标冲突。 |
| **js/sync/syncAgent.js** | 冲突逻辑 | **NEEDS_UPDATE** | 代码具备基础同步，但缺乏 UI 触发逻辑。 |

## 2. 文档 vs 代码一致性核对 (Alignment Check)

| 核心领域 (Core Area) | 现状分析 (Current State) | 结论 (Conclusion) | 修正方案 (Action) |
| :--- | :--- | :--- | :--- |
| **Auth 登录/注册** | **代码**：使用原生 `fetch` 调用 REST API。<br>**文档 (Phase 5)**：要求使用 `@supabase/supabase-js`。<br>**README**: 仅提及纯前端 Mock Auth。 | ❌ **严重不一致** | 1. 代码迁移至 SDK。<br>2. 更新 README 说明真实 Auth 流程。 |
| **Sync Engine / RPC** | **代码**：Edge Functions (`sync-push/pull`) 已部署，含 Header 修复。<br>**文档**：缺乏对 JSON 协议和 Header 要求的描述。 | ⚠️ **文档缺失** | 在 `ARCHITECTURE.md` 中补充 Sync 协议规范（JSON Schema, Headers）。 |
| **本地缓存 (Queue)** | **代码**：`changeLog` 表存在，逻辑基本跑通。<br>**文档**：`blueprint.md` 提及 "cacheToLocal"，描述尚可。 | ✅ **基本一致** | 暂无急需修改。 |
| **冲突逻辑 (Conflict)** | **代码**：后端返回 `conflicts` 数组，前端 `conflict.js` 有策略逻辑。<br>**文档 (Phase 5)**：要求 "UI 介入"。<br>**缺失**：代码中无 UI 触发点。 | ❌ **逻辑断层** | 实现 `modal-conflict.js` 并将其挂载到 `syncAgent.js` 的回调中。 |
| **PWA / 离线机制** | **代码**：完全无 `sw.js` 或 `manifest.json`。<br>**文档 (Phase 5)**：列为 P2 优先级任务。 | ❌ **完全缺失** | 按计划执行 Phase 5 PWA 任务。 |
| **配置 / 环境变量** | **代码**：`config.toml` (Port 65432) 与 `supabaseClient.js` (VITE_ vars) 匹配。<br>**文档**：`README` 未提及 `.env` 配置。 | ⚠️ **文档滞后** | 在 README "Getting Started" 章节补充环境变量配置指南。 |

## 3. 审计总结 (Summary)

*   **Yin (文档)** 严重滞后于 **Yang (代码)**。项目已进化为 "Full Stack" (Docker/Supabase)，但文档仍呈现为 "Static Site"。
*   **关键断点**：
    1.  **SDK 集成**：代码还没动，文档说要动。
    2.  **冲突 UI**：后端准备好了，前端没接。
    3.  **PWA**：完全空白。

## 4. 下一步行动 (Next Steps)

1.  **立即更新 README**：这是门面，必须反映真实架构。
2.  **重构 Auth**：引入 SDK，这是 Phase 5 的基石。
3.  **补全架构文档**：记录 Sync 协议，方便后续维护。
