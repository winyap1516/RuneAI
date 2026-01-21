# 📦 模块拆分计划 (Module Split Plan)

## 🎯 目标
将巨大的 `js/dashboard.js` (1000+ 行) 拆分为符合 MVC 架构的独立模块，提升代码可维护性与可测试性。

## 📂 目录结构 (Phase 2 结束时)
```
js/
├── components/           # 可复用的 UI 组件逻辑
│   ├── modal.js          # 通用模态框控制
│   └── toast.js          # 消息提示
├── config/
│   └── constants.js      # 全局常量 (已创建)
├── controllers/          # 业务逻辑控制器
│   ├── linkController.js # 链接管理 (CRUD)
│   └── digestController.js # 摘要生成与管理
├── services/             # 核心服务 (Yin Layer)
│   ├── ai.js             # AI 接口 (标准化)
│   ├── quota.js          # 配额管理 (新增)
│   └── storage/          # (原有 storageAdapter)
├── templates/            # 纯 HTML 模板函数
│   ├── card.js           # 链接卡片模板
│   └── digestCard.js     # 摘要卡片模板
├── views/                # 视图渲染与 DOM 操作
│   ├── linksView.js      # 链接列表视图
│   └── digestView.js     # 摘要列表视图
├── utils/                # 工具函数
│   ├── dom.js            # (已存在)
│   ├── state.js          # 简单的全局状态 (Sidebar, User)
│   └── url.js            # (已存在)
└── main.js               # 入口文件 (初始化)
```

## 3. 迁移步骤与 PR 规划 (Migration Steps)

为了避免 "Big Bang" 重构导致的系统瘫痪，建议分 4 个步骤（PR）进行迁移。

### Phase 1: 提取模板 (Templates Extraction) ✅ **已完成**
*   **目标**: 将 `dashboard.js` 中所有 `createCard`, `renderDigestView` 中的 HTML 拼接逻辑移出。
*   **文件**:
    *   创建 `js/templates/card.js` ✅
    *   创建 `js/templates/digestCard.js` ✅
    *   创建 `js/utils/ui-helpers.js` ✅
*   **PR Scope**: 仅移动函数，保持逻辑不变，`dashboard.js` 引入并调用新模板。
*   **验收**: 界面渲染无变化。
*   **完成时间**: 2025年11月30日
*   **审查状态**: ✅ Arch: PASS

### Phase 2: 控制器与视图拆分 (Controller & View Split) ✅ **已完成**
*   **目标**: 拆解 `dashboard.js` 巨石结构，实现 MVC 架构。
*   **执行步骤**:
    1.  **PR1: Link Controller 提取** ✅
        *   创建 `js/controllers/linkController.js`
        *   移出 CRUD 逻辑
        *   状态: 已完成 (Arch: PASS)
    2.  **PR2: Digest Controller 提取** ✅
        *   创建 `js/controllers/digestController.js`
        *   移出 Manual/Daily Digest 生成逻辑
        *   移出 Digest 列表获取与删除逻辑
        *   规范化 AI Service 调用 (`createDigestForWebsite`)
        *   状态: 已完成 (Arch: PASS)
    3.  **PR3: 视图层拆分** ✅
        *   创建 `js/views/linksView.js` & `js/views/digestView.js`
        *   移出 DOM 操作与事件绑定
        *   `dashboard.js` 转变为纯路由/入口层
        *   状态: 已完成 (Arch: PASS)

### Phase 2.5: 服务层标准化 (Service Normalization) 🔄 **进行中**
*   **目标**: 规范化 Service 层，确立 Yin 层稳定性。
*   **执行步骤**:
    1.  **PR4: Service 层重构** 🔄 **进行中**
        *   规范化 `js/services/ai.js` 接口与错误处理
        *   创建 `js/services/quota.js` 统一配额管理
        *   统一日志写入 (`storageAdapter.addGenerationLog`)
        *   补充单元测试 (`tests/digestController.test.js`, `tests/aiService.test.js`)

### Phase 3: 清理与优化 (Cleanup & Optimization) ✅ **已完成**
*   **目标**: 移除旧代码，优化性能。
*   **任务**:
    *   移除 `dashboard.js` 中残留的未使用函数
    *   优化 DOM 操作性能 (Batch update)
    *   补充更多 E2E 测试

### Phase 4: 云端同步与迁移 (Cloud Sync) ✅ **已完成**
*   **目标**: 接入 Supabase Auth、RLS 与 Sync Engine。
*   **完成内容**:
    *   **Supabase Client**: `js/services/supabaseClient.js` 统一 JWT 与 API 调用
    *   **Sync Agent**: `js/sync/syncAgent.js` + `changeLog.js` 实现双向同步与离线支持
    *   **Cloud RPC**: `/sync-push` (事务) 与 `/sync-pull` (多资源) 落地
    *   **Migration**: `migrateLocalToCloud()` 工具实现 IndexedDB 上云
    *   **Storage Adapter**: 深度改造支持 `enqueueChange` 与 `updated_at` 维护
