# 模块拆分计划 (Module Split Plan)

## 1. 现状分析 (Current State)

目前 `js/features/dashboard.js` 是一个 >1700 行的 "God Object"，承担了过多的职责：
*   **UI 渲染**: HTML 字符串拼接（Card, Modal, Sidebar）。
*   **事件处理**: DOM 事件绑定、事件委托。
*   **业务逻辑**: 每日限额检查、冷却倒计时、数据转换。
*   **状态管理**: 侧边栏折叠、Loading 状态。

**风险**: 维护困难，多人协作冲突概率高，单元测试难以进行。

## 2. 目标架构 (Target Architecture)

我们将采用类 MVC 结构进行拆分，保持 Vanilla JS 的轻量特性，不引入重型框架。

### 2.1 目录结构建议

```text
js/
├── components/           # 可复用的 UI 组件逻辑
│   ├── modal.js          # 通用模态框控制
│   └── toast.js          # 消息提示
├── config/
│   └── constants.js      # 全局常量 (已创建)
├── controllers/          # 业务逻辑控制器
│   ├── linkController.js # 链接管理 (CRUD)
│   └── digestController.js # 摘要生成与管理
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

### Phase 1: 提取模板 (Templates Extraction)
*   **目标**: 将 `dashboard.js` 中所有 `createCard`, `renderDigestView` 中的 HTML 拼接逻辑移出。
*   **文件**:
    *   创建 `js/templates/card.js`
    *   创建 `js/templates/digestCard.js`
*   **PR Scope**: 仅移动函数，保持逻辑不变，`dashboard.js` 引入并调用新模板。
*   **验收**: 界面渲染无变化。

### Phase 2: 提取服务逻辑 (Service Logic Extraction)
*   **目标**: 消除 `dashboard.js` 中的 AI 生成、数据库读写逻辑。
*   **任务**:
    *   确保 `js/services/ai.js` 包含完整的 `createDigestForWebsite` 逻辑（含错误处理、日志）。
    *   `dashboard.js` 中的 `Generate Now` 和 `Generate Daily` 改为调用 Service。
*   **PR Scope**: 重构业务逻辑，不涉及 UI 变动。

### Phase 3: 拆分视图与控制器 (View & Controller Split)
*   **目标**: 拆解 `dashboard.js` 主体。
*   **文件**:
    *   创建 `js/views/linksView.js`: 负责 `renderLinks`, `filterCards`, `bindEvents`。
    *   创建 `js/controllers/linkController.js`: 负责协调 Storage 和 View。
*   **PR Scope**: 将 Links 相关代码移出，`dashboard.js` 仅保留入口和路由分发。

### Phase 4: 清理与标准化 (Cleanup)
*   **目标**: 删除 `dashboard.js` 中的废弃代码，统一引用路径。
*   **任务**:
    *   将 `initDashboard` 瘦身或重命名为 `app.js`。
    *   完善新模块的 JSDoc 注释。

## 4. 接口定义示例

### `templates/card.js`
```javascript
/**
 * @param {object} data - Link object
 * @returns {string} HTML string
 */
export function cardTemplate(data) { ... }
```

### `controllers/linkController.js`
```javascript
import storageAdapter from '../storage/storageAdapter.js';
import { cardTemplate } from '../templates/card.js';

export async function handleAddLink(url) {
  // 1. Validate
  // 2. Call Storage
  // 3. Update UI (via View)
}
```
