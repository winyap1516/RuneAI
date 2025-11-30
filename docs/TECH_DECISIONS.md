# 技术选型与决策 (Technology Decisions)

## 1. 前端框架: Vanilla JS (ES Modules)

### 决策
继续保持使用 **原生 JavaScript (ES Modules)**，不引入 React/Vue 等现代框架。

### 理由 (Rationale)
1.  **Yin-Yang 架构契合度**: 前端 (Yang) 应当轻量、灵活。Vanilla JS 直接操作 DOM，能最大程度发挥浏览器的原生性能，符合 "Creative Energy" 的定位。
2.  **学习曲线与招聘**: 项目初期由 Solo 开发者维护，引入复杂构建工具链（Webpack/Vite + React）会增加维护负担。
3.  **性能**: 对于当前规模（< 1000 条数据），手动 DOM 操作配合 Tailwind 的性能损耗远小于 Virtual DOM 的 Overhead。

### 替代方案对比
*   **React**: 适合状态极其复杂的应用。当前 RuneAI 状态主要在 DB，UI 状态较少，React 显得过重。

## 2. 本地存储: IndexedDB (Native Wrapper)

### 决策
使用原生 `IndexedDB` API 的轻量封装 (`js/storage/db.js`)，而非 Dexie.js。

### 理由
1.  **依赖最小化**: 减少第三方依赖，降低打包体积。
2.  **控制力**: 直接控制事务和索引，便于后续实现特定的同步逻辑。
3.  **迁移便利性**: 我们的 Wrapper 接口设计为 Promise 风格，未来如果需要切换到底层更快的库（如 SQLite Wasm）或云端 SDK，只需替换 Adapter 层。

## 3. 后端服务: Supabase

### 决策
选用 **Supabase** 作为后端基础设施（Database, Auth, Edge Functions）。

### 理由
1.  **PostgreSQL**: 世界上最强大的开源关系型数据库，支持 JSONB，非常适合存储结构多变的 Link Metadata。
2.  **Edge Functions (Deno)**: 允许编写 TypeScript/JS 后端逻辑，与前端语言栈统一。
3.  **Row Level Security (RLS)**: 可以在数据库层面强制执行安全规则，极大简化应用层代码。
4.  **成本**: 这里的 "Scale to Zero" 特性非常适合初创项目。

### 替代方案对比
*   **Firebase**: NoSQL 结构在处理复杂关联（如 Digest 与 Link 的多对多关系）时不如 SQL 顺手。
*   **Custom Node.js**: 运维成本（部署、扩容、数据库维护）太高。

## 4. 任务调度: Client-Side Scheduler (Phase 1) -> Cloud Cron (Phase 2)

### 决策
*   **当前**: 使用前端 `setTimeout` / `requestIdleCallback` 模拟调度。
*   **未来**: 迁移至 Supabase **pg_cron** 或 Edge Function 定时触发。

### 理由
前端调度不可靠（页面关闭即停止），仅作为单机版过渡方案。云端 Cron 是生产环境的唯一选择。

## 5. 服务层标准化 (Service Layer Normalization)

### 决策
确立 `js/services/` 为唯一的业务逻辑/外部服务交互层 (Yin Layer)，禁止 Controller 直接处理原始 API 错误或直接操作底层 AI 逻辑。

### 理由
1.  **关注点分离**: Controller 负责业务流程控制 (Validation -> Service -> Storage -> UI Feedback)，Service 负责具体的原子能力实现 (AI, Quota)。
2.  **错误边界**: `ai.js` 等服务必须捕获底层异常（网络、超时、解析），并返回统一的 `{ ok, error }` 结构，防止 UI 层崩溃。
3.  **可测试性**: 独立的 Service 层便于 Mock 和单元测试，无需启动完整的 UI 环境。
