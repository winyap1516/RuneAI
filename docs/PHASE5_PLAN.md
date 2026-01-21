# Phase 5: 生产级强化与体验闭环 (Harmony & Experience)

**目标**: 补齐前端交互短板，实现 Auth UI、冲突解决界面与 PWA 离线能力，达成端到端“和谐”体验。

## 🗓️ 里程碑规划 (Milestones)

### Milestone 5.1: 身份之门 (Auth UI & Logic) - **Priority: P0**
**目标**: 让用户能真正登录并看到自己的数据。
*   **任务**:
    1.  [ ] **SDK 集成**: 在 `index.html` 引入 `@supabase/supabase-js` (CDN)。
    2.  [ ] **Client 改造**: 重构 `js/services/supabaseClient.js`，对接 SDK Auth 方法。
    3.  [ ] **UI 逻辑**: 实现 `js/features/auth_ui.js`，绑定登录/注册表单事件。
    4.  [ ] **状态联动**: 登录成功后自动触发数据迁移与同步 (`initSyncAfterLogin`)。

### Milestone 5.2: 冲突之舞 (Conflict Resolution) - **Priority: P1**
**目标**: 优雅地解决多端数据冲突，赋予用户决策权。
*   **任务**:
    1.  [ ] **组件开发**: 创建 `js/components/modal-conflict.js` (Diff 对比视图)。
    2.  [ ] **Sync 接入**: 改造 `js/sync/syncAgent.js`，处理 RPC 返回的 `conflicts`。
    3.  [ ] **策略实现**: 支持 "Keep Local" (Force Push) 与 "Keep Server" (Overwrite Local) 操作。

### Milestone 5.3: 离线之根 (PWA & Offline) - **Priority: P2**
**目标**: 断网环境下应用仍可秒开。
*   **任务**:
    1.  [ ] **Manifest**: 配置 `manifest.json` (Icon, Name, Colors)。
    2.  [ ] **Service Worker**: 编写 `sw.js`，缓存核心 Shell (HTML/CSS/JS)。
    3.  [ ] **生命周期**: 在 `main.js` 中注册 SW 并处理更新提示。

---

## 🛠️ 技术决策更新

### 1. 引入 Supabase SDK
*   **决策**: 前端不再手写 fetch 调用 Auth API，改为使用 `@supabase/supabase-js`。
*   **理由**: 安全性更高（自动处理 Token 刷新），开发效率更高，且体积在可接受范围内。

### 2. 冲突处理策略: UI 介入
*   **决策**: 当发生数据冲突时，暂停同步队列，弹出 Modal 让用户人工决策。
*   **理由**: 对于书签管理场景，自动合并容易产生意外结果；"Local-First" 理念应尊重用户的当前意图。

---

## 📊 验收标准 (Acceptance Criteria)

1.  **Auth**: 用户可完成注册、登录、退出，Token 自动持久化且过期自动刷新。
2.  **Sync**: 
    *   登录后，本地数据自动迁移至云端。
    *   多端操作时，数据能在 10s 内同步。
    *   制造冲突（离线修改同一条目）后，上线能看到冲突弹窗并成功解决。
3.  **Offline**: 
    *   断网状态下刷新页面，应用正常加载（不显示浏览器恐龙页）。
    *   断网操作（增删改）在恢复网络后自动同步。
