# Phase 5 文档更新包 (Documentation Upgrade Package)

本文件包含需更新或新增的核心文档内容。请直接复制对应部分覆盖原文件。

---

## 📁 文件: `README.md`
**说明**: 完全重写，反映 Phase 5 架构 (Supabase + Local-First)。

```markdown
# WebBookmark AI Assistant (Phase 5)

> **Local-First 网页收藏与智能追踪系统**
> *结合本地优先的流畅体验与云端同步的强大能力*

## 🌟 项目简介 (Introduction)

WebBookmark AI Assistant 是一个进化的网页收藏工具。它不仅仅是一个书签管理器，更是一个智能的个人知识库。
*   **Local-First**: 基于 IndexedDB (Dexie.js) 的本地存储，断网可用，操作零延迟。
*   **Cloud Sync**: 基于 Supabase Edge Functions 的智能同步，支持多端数据一致性。
*   **AI Ready**: 预留 AI 接口，自动生成网页摘要与洞察（Coming Soon）。

## 🚀 核心特性 (Features)

*   **🛡️ 身份验证**: 集成 Supabase Auth (JWT)，安全可靠。
*   **🔄 智能同步**: 差异化同步 (Delta Sync) + 冲突解决策略 (Conflict Resolution)。
*   **📱 离线可用**: PWA 支持 (Phase 5 正在进行)，断网也能查看和管理书签。
*   **🎨 现代化 UI**: Tailwind CSS 构建，响应式设计，支持深色模式。
*   **🧩 模块化架构**: 五行架构 (Five-Elements) 设计，清晰分离业务、数据与基础设施。

## 🛠️ 技术栈 (Tech Stack)

*   **Frontend**: HTML5, Vanilla JS (ES Modules), Tailwind CSS (CDN/JIT)
*   **Storage**: Dexie.js (IndexedDB Wrapper)
*   **Backend**: Supabase (PostgreSQL, Edge Functions, GoTrue Auth)
*   **DevOps**: Docker, Supabase CLI

## 🚦 快速开始 (Getting Started)

### 前置要求
*   Node.js & NPM
*   Docker Desktop (用于本地 Supabase 实例)

### 1. 启动本地后端
```bash
# 启动 Supabase 本地实例 (Port: 65432)
npx supabase start
```

### 2. 配置环境变量
复制 `.env.example` 为 `.env`，并填入 Supabase 输出的 URL 和 Key：
```ini
VITE_SUPABASE_URL=http://127.0.0.1:65432
VITE_SUPABASE_ANON_KEY=eyJxh...
```

### 3. 启动前端开发服
```bash
npm install
npm run dev
# 访问 http://localhost:5173
```

## 🗺️ 路线图 (Roadmap)

*   [x] **Phase 1-3**: 基础收藏功能、UI 组件化、Docker 环境搭建。
*   [x] **Phase 4**: 后端架构升级 (Edge Functions + RPC)。
*   [ ] **Phase 5 (进行中)**:
    *   集成 Supabase JS SDK。
    *   UI 驱动的冲突解决。
    *   PWA 离线能力增强。

## 📂 目录结构

*   `/js`: 前端核心逻辑 (Features, Services, Sync)。
*   `/supabase`: 后端定义 (Migrations, Functions, Config)。
*   `/docs`: 项目文档与架构设计。

---
```

---

## 📁 文件: `docs/ARCHITECTURE.md`
**说明**: 增加 Sync Protocol 与 Auth Flow 章节。

```markdown
# 系统架构文档 (System Architecture)

## 🏗️ 总体架构 (Overview)

本项目采用 **Local-First** 架构，遵循“五行”分类原则：

*   **木 (Wood - Business)**: Dashboard, Bookmark CRUD.
*   **火 (Fire - Performance)**: Edge Functions, Async Tasks.
*   **土 (Earth - Infrastructure)**: Supabase (PostgreSQL), IndexedDB.
*   **金 (Metal - Security)**: Auth (RLS, JWT), Validation.
*   **水 (Water - Flow)**: Sync Engine, Data Pipeline.

## 🔄 同步协议 (Sync Protocol)

同步引擎负责在本地 DexieDB 与云端 Supabase 之间传输数据。

### 1. Push (Client -> Server)
*   **Trigger**: 用户操作 (Add/Edit/Delete) 或网络恢复。
*   **Endpoint**: `functions/v1/sync-push`
*   **Payload**:
    ```json
    {
      "changes": [
        { "id": "uuid", "table": "bookmarks", "action": "create", "data": {...}, "modified_at": 1234567890 }
      ],
      "last_pulled_at": 1234567800
    }
    ```
*   **Response**:
    ```json
    {
      "applied": ["uuid1"],
      "conflicts": [
        { "id": "uuid2", "server_record": {...}, "error": "conflict_detected" }
      ]
    }
    ```

### 2. Pull (Server -> Client)
*   **Trigger**: 应用启动、Push 完成后、定时轮询。
*   **Endpoint**: `functions/v1/sync-pull`
*   **Logic**: 获取 `last_pulled_at` 之后的所有变动。

## 🛡️ 认证流程 (Auth Flow)

**(Phase 5 Update)**
前端集成 `@supabase/supabase-js` SDK，接管 Auth 状态管理。

1.  **Login**: SDK 处理 `signInWithPassword`，获取 JWT。
2.  **Storage**: SDK 自动持久化 Session 到 `localStorage`。
3.  **Request**: `supabaseClient.js` 自动从 SDK Session 提取 Token，注入 HTTP Header (`Authorization: Bearer ...`)。
4.  **RLS**: 数据库层根据 JWT `sub` 字段强制实施行级安全策略。

---
```

---

## 📁 文件: `docs/TECH_DECISIONS.md`
**说明**: 更新关于 Auth 和 SDK 的决策。

```markdown
### [Decision-005] 引入 Supabase JS SDK
*   **Status**: Accepted (Phase 5)
*   **Context**: 早期版本为了轻量化，手动封装了 `fetch` 请求。随着 Auth 逻辑变复杂（Refresh Token, Session 监听），手动维护成本过高。
*   **Decision**: 在 `index.html` 通过 CDN 引入 `@supabase/supabase-js`。
*   **Consequences**:
    *   (+) 极大简化 Auth 代码。
    *   (+) 自动处理 Token 刷新，提高安全性。
    *   (-) 增加少量首屏加载体积 (可通过 CDN 缓存缓解)。
    *   (Action) 需重构 `supabaseClient.js` 适配 SDK。

### [Decision-006] 冲突解决策略
*   **Status**: Accepted (Phase 5)
*   **Context**: 自动合并 (Last-Write-Wins) 可能导致用户数据丢失。
*   **Decision**: 采用 "UI 介入" 策略。当 Server 返回 Conflict 时，暂停队列，弹出 Modal 让用户选择 "Keep Local" 或 "Use Server"。
```
