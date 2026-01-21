# YinGan Project Rules & Architecture Standards

## 1. 核心原则 (Core Principles)
- **语言规范**: UI/文案统一使用 **英文 (English)**。代码注释、开发文档、沟通使用 **中文 (Chinese)**。
- **架构哲学**: 遵循「阴阳八卦五行·君臣佐使」架构体系。
  - **阴 (Yin)**: 稳定性、数据库 (Postgres)、类型安全 (Pydantic/TypeScript)。
  - **阳 (Yang)**: 灵活性、AI 计算 (OpenAI)、前端交互 (React)。
  - **五行 (Five Elements)**:
    - **木 (Wood)**: 业务逻辑 (FastAPI Services)
    - **火 (Fire)**: AI & 计算 (Worker, Scraper, GPT-4o)
    - **土 (Earth)**: 基础设施 (Docker, Postgres, Alembic)
    - **金 (Metal)**: 规范与安全 (Validation, Auth, Linting)
    - **水 (Water)**: 接口与流转 (API, Async Tasks)

## 2. 系统架构 (System Architecture)

### A. 后端 (Backend) - Python Core
*   **路径**: `backend/python/`
*   **框架**: FastAPI (Async)
*   **数据库**: PostgreSQL (Local Docker port `5433`)
*   **ORM**: SQLAlchemy + PgVector (Vector Extension)
*   **AI 引擎**: OpenAI SDK (`gpt-4o`) + BeautifulSoup4 (网页抓取)
*   **向量检索**: `ivfflat` indices on `messages`, `runes`, `memories`.
*   **任务队列**: `BackgroundTasks` (当前), 预留 Celery 升级空间。
*   **核心端口**: `8003` (Local Dev)

### B. 前端 (Frontend) - Client Layer
*   **路径**: Root (`/`)
*   **框架**: React + Vite
*   **样式**: TailwindCSS
*   **语言**: JavaScript/TypeScript
*   **核心端口**: `5173` / `5174`

### C. 数据流 (Data Flow)
1.  **Input**: 用户输入 URL -> 前端调用 `POST /sync`
2.  **Ingest (Monarch)**: FastAPI 接收请求 -> 写入 DB (`links` status='queued') -> 立即返回 Job ID。
3.  **Process (Minister/Fire)**: 后台 Worker 启动 -> 抓取网页内容 (BS4) + 提取标题 -> 调用 OpenAI (GPT-4o) -> 生成 JSON (Summary, Category, Tags)。
4.  **Persist (Earth)**: 更新 DB (`links` description, category, tags, status='completed') -> 记录日志 (`generation_logs`)。
5.  **Output (Envoy)**: 前端轮询或收到通知 -> 展示结果。

### D. 记忆与 Rune 系统 (Memory & Rune System)
1.  **Runes (显式知识)**: 用户将消息保存为 Rune -> 生成 Embedding -> 存入 `runes` 表。
2.  **Memories (隐式/长期记忆)**: 
    -   **Consolidation**: `POST /memories/consolidate` 自动摘要最近对话 -> 生成 Memory Node -> 存入 `memories` 表。
    -   **Retrieval (Hybrid RAG)**: `/chat` 接口同时检索 Runes (Top-3) 和 Memories (Top-3) -> 拼接到 System Prompt。
3.  **RuneSpace**: 首页展示 "My Runes" (Grid) 和 "Long-term Memories" (List)，提供可视化管理。

## 3. 开发规范 (Development Standards)

### 命名与文件
- **Python**: 蛇形命名 (`process_ai_task`), 类名大驼峰 (`GenerationLog`).
- **JS/TS**: 小驼峰 (`fetchLinkStatus`), 组件大驼峰 (`LinkCard`).
- **数据库**: 表名复数 (`users`, `links`, `memories`, `runes`), UUID 主键。

### 关键配置 (Environment)
- 本地开发需加载 `backend/python/.env`。
- **OPENAI_API_KEY**: 必须配置，否则回退至 Mock 模式。
- **DATABASE_URL**: 指向本地 Docker Postgres (`localhost:5433`)。
- **EMBEDDING_MODEL**: 默认 `text-embedding-3-small` (1536维)。

### 智能体行为准则 (Agent Guidelines)
1.  **修改代码前**: 必须先理解五行归属。修改 DB 属土，修改 AI 属火。
2.  **验证**: 每次修改后端必须运行 `python tests/verify_rune_flow.py` (Rune/Memory 流程) 或 `verify_e2e.py` (Link 流程) 确保闭环。
3.  **文档**: 架构变更必须同步更新本文档。

## 4. 当前状态快照 (Current State Snapshot)
- **Backend Status**: Running on port `8003`.
- **DB Status**: Docker container `python-db-1` on port `5433` (Vector Extension Enabled).
- **AI Model**: `gpt-4o` + Embedding enabled.
- **Frontend**: Vite Dev Server running.
- **Features**: 
    -   Link Management (Auto-tagging/Categorization).
    -   Chat (RAG with Runes & Memories).
    -   RuneSpace (Home Dashboard).
    -   Memory Consolidation (Auto-summarization).
