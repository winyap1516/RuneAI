# RuneAI 系统架构蓝图 (Architecture Blueprint)

## 1. 核心设计哲学 (Core Philosophy)

RuneAI 遵循 **Yin-Yang Architecture**（阴阳架构）原则：

*   **Yin (阴 - 后端/数据层)**: 代表稳定性、数据完整性、业务规则验证。
    *   **技术栈**: Supabase (PostgreSQL, Edge Functions), IndexedDB (Local Cache), StorageAdapter.
    *   **职责**: 数据持久化、权限校验、复杂计算、安全性。
*   **Yang (阳 - 前端/交互层)**: 代表创造力、用户体验、即时反馈。
    *   **技术栈**: Vanilla JS (ES Modules), Tailwind CSS, HTML5.
    *   **职责**: UI 渲染、交互动画、本地状态管理、用户意图捕获。

## 2. 系统上下文 (System Context)

```mermaid
graph TD
    User[用户] -->|交互| UI[前端 UI (Yang)]
    UI -->|事件| Controller[控制器/逻辑层]
    
    subgraph "Browser Client"
        Controller -->|读写| Adapter[Storage Adapter]
        Adapter -->|本地持久化| IDB[(IndexedDB)]
        Controller -->|调度| Scheduler[任务调度器]
        Scheduler -->|生成请求| AIService[AI Service]
    end
    
    subgraph "Cloud Infrastructure (Yin)"
        AIService -->|API 调用| EdgeFn[Supabase Edge Functions]
        EdgeFn -->|数据同步| PG[(Supabase Postgres)]
        EdgeFn -->|LLM 调用| OpenAI[External LLM API]
    end
```

## 3. 模块划分 (Module Breakdown)

### 3.1 前端表现层 (Presentation Layer) - Yang 层

**✅ 已完成模块 (Phase 1)**
*   **Templates**: 纯函数组件，返回 HTML 字符串
    *   ✅ `templates/card.js`: 链接卡片模板 (已完成)
    *   ✅ `templates/digestCard.js`: 摘要卡片模板 (已完成)
    *   ✅ `templates/ui-helpers.js`: UI 辅助函数 (已完成)

**🔄 待拆分模块 (Phase 2-3)**
*   **Entry**: `main.js` (应用引导，路由分发)
*   **Views**: 负责 DOM 渲染与事件绑定（拆分自 `dashboard.js`）
    *   🔄 `views/linksView.js`: 链接卡片列表、筛选、搜索
    *   🔄 `views/digestView.js`: 摘要日报视图、详情弹窗
    *   🔄 `views/modalView.js`: 模态框管理
    *   🔄 `views/sidebarView.js`: 侧边栏状态管理

**📋 设计原则 (Yang 层原则)**
*   **纯函数优先**: Templates 必须是纯函数（无副作用）
*   **事件委托**: Views 使用事件委托，避免直接 DOM 操作
*   **状态最小化**: 尽量将状态提升到 Controller 层
*   **响应式**: 支持主题切换、响应式布局
*   **动画流畅**: 使用 CSS 过渡，避免 JS 动画阻塞

### 3.2 业务逻辑层 (Logic Layer)
*   **Controllers**: 处理用户输入，协调 Model 与 View。
    *   `controllers/linkController.js`: 处理 CRUD、导入、校验。
    *   `controllers/digestController.js`: 处理手动生成、重试逻辑。
*   **Services**: 封装复杂业务或外部调用。
    *   `services/ai.js`: 统一 AI 摘要生成接口（Mock/Cloud 切换）。
    *   `services/scheduler.js`: 处理定时任务（自动日报生成）。

### 3.3 数据持久层 (Data Layer)
*   **Storage Adapter**: 统一数据访问接口（DAO 模式）。
    *   屏蔽底层存储细节（IndexedDB vs localStorage vs Cloud）。
    *   提供 `getLinks()`, `addDigest()` 等语义化方法。
*   **Database Wrapper**: `js/storage/db.js`
    *   IndexedDB 的底层封装，处理事务、索引、版本升级。

## 4. 数据流与安全边界 (Data Flow & Security)

### 4.1 关键数据流
1.  **用户添加链接**:
    UI (Input) -> Controller (Validate) -> Service (Fetch Meta) -> Adapter (Add) -> IndexedDB -> UI (Update)
2.  **生成摘要 (Manual/Daily)**:
    UI (Click) -> Controller (Check Quota) -> Service (AI Gen) -> Adapter (Save Digest & Log) -> IndexedDB -> UI (Update)

### 4.2 安全边界 (Security Boundaries)
*   **前端验证 (Weak)**:
    *   `userId === 'local-dev'` 仅用于本地调试和 UI 展示控制。
    *   每日额度限制 (`LIMITS`) 在前端仅作为用户体验优化，防止误操作。
*   **后端验证 (Strong - Future)**:
    *   所有写入操作（`addLink`, `addDigest`）必须经过 Edge Function 验证。
    *   **API Key**: 存储在 Supabase Vault，前端不可见。
    *   **Rate Limiting**: 在 Edge Function 层进行 IP/User 级别的限流。
    *   **Row Level Security (RLS)**: 数据库层强制执行 `user_id` 隔离。

## 5. 短期行动清单 (接下来 4 周)

| 优先级 | 任务 (Issue) | 描述 | Owner | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | **FIX-001** | 修复 ID 类型兼容性与错误处理 (Generate/Subscribe/Delete) | Solo | ✅ Done |
| **P0** | **FIX-002** | 持久化冷却状态 (Cooldown Persistence) | Solo | ✅ Done |
| **P1** | **FEAT-001** | 明确区分 Manual vs Daily 摘要生成逻辑 | Solo | ✅ Done |
| **P1** | **REFACTOR-001** | 提取 `constants.js` 并消除硬编码字符串 | Solo | ✅ Done |
| **P2** | **REFACTOR-002** | **将摘要生成逻辑统一迁移至 `ai.js`** (消除 Dashboard 重复代码) | Solo | 🔄 In Progress |
| **P2** | **ARCH-001** | **拆分 `dashboard.js` - 第一阶段 (提取 Templates)** | Solo | ✅ **Completed** |
| **P2** | **ARCH-002** | **拆分 `dashboard.js` - 第二阶段 (提取 Controllers)** | Solo | 📋 Ready |
| **P3** | **PERF-001** | 为 Links 列表实现分页加载 (IndexedDB 游标) | Solo | To Do |
