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

### Phase 2: 控制器与视图拆分 (Controller & View Split) 🔄 **进行中**
*   **目标**: 拆解 `dashboard.js` 巨石结构，实现 MVC 架构。
*   **执行步骤**:
    1.  **PR1: Link Controller 提取** ✅
        *   创建 `js/controllers/linkController.js`
        *   移出 CRUD 逻辑
        *   状态: 已完成 (Arch: PASS)
    2.  **PR2: Digest Controller 提取** 🔄 **进行中**
        *   创建 `js/controllers/digestController.js`
        *   移出 Manual/Daily Digest 生成逻辑
        *   移出 Digest 列表获取与删除逻辑
        *   规范化 AI Service 调用 (`createDigestForWebsite`)
    3.  **PR3: 视图层拆分** 📅 **待启动**
        *   创建 `js/views/linksView.js` & `js/views/digestView.js`
        *   移出 DOM 操作与事件绑定
        *   `dashboard.js` 转变为纯路由/入口层

### Phase 3: 服务层完善 (Service Layer Refinement)
*   **目标**: 完善 `js/services/` 目录，强化 AI 与 Storage 服务。
*   **任务**:
    *   完善 `ai.js` 错误处理与重试机制
    *   完善 `storage.js` (如果需要进一步封装 storageAdapter)

### Phase 4: 清理与标准化 (Cleanup)
*   **目标**: 删除 `dashboard.js` 中的废弃代码，统一引用路径。
*   **任务**:
    *   将 `initDashboard` 瘦身或重命名为 `app.js`。
    *   完善新模块的 JSDoc 注释。

## 4. Phase 2 实施指南 (Phase 2 Implementation Guide)

### 4.1 Service 层设计原则

**AI Service (`js/services/ai.js`)**
```javascript
/**
 * AI摘要生成服务
 * 提供统一的AI调用接口，包含错误处理和重试机制
 */
export const aiService = {
  /**
   * 为单个网站生成摘要
   * @param {Object} params - 生成参数
   * @param {string} params.url - 网站URL
   * @param {string} params.userId - 用户ID
   * @param {number} params.linkId - 链接ID
   * @returns {Promise<Object>} 摘要结果
   */
  async generateSingle({ url, userId, linkId }) {
    // 实现逻辑：调用外部AI服务，处理错误，记录日志
  },

  /**
   * 批量生成摘要（每日定时任务）
   * @param {Array} subscriptions - 订阅列表
   * @returns {Promise<Array>} 生成结果数组
   */
  async generateBatch(subscriptions) {
    // 实现逻辑：批量处理，失败重试，结果汇总
  }
};
```

**Storage Service (`js/services/storage.js`)**
```javascript
/**
 * 存储服务
 * 抽象所有存储操作，提供统一的数据访问接口
 */
export const storageService = {
  // 链接管理
  async getLinks(filters = {}) { ... },
  async createLink(linkData) { ... },
  async updateLink(id, updates) { ... },
  async deleteLink(id) { ... },
  
  // 订阅管理
  async getSubscriptions() { ... },
  async createSubscription(subData) { ... },
  async updateSubscription(id, updates) { ... },
  async deleteSubscription(id) { ... },
  
  // 摘要管理
  async getDigests(options = {}) { ... },
  async createDigest(digestData) { ... },
  async updateDigest(id, updates) { ... },
  async deleteDigest(id) { ... }
};
```

### 4.2 重构步骤 (Refactoring Steps)

1. **创建 Service 文件** (1-2小时)
   - 新建 `js/services/ai.js` 和 `js/services/storage.js`
   - 从 `dashboard.js` 中提取相关函数
   - 添加完整的 JSDoc 注释

2. **重构 AI 调用逻辑** (2-3小时)
   - 找到所有 `mockAIFromUrl` 和 `createDigestForWebsite` 调用
   - 替换为 `aiService.generateSingle()` 调用
   - 确保错误处理逻辑完整

3. **重构存储操作** (3-4小时)
   - 替换所有 `storageAdapter` 直接调用
   - 通过 `storageService` 进行数据操作
   - 保持数据转换和验证逻辑

4. **测试验证** (1-2小时)
   - 手动测试所有功能：添加链接、生成摘要、订阅管理
   - 验证错误处理是否正常工作
   - 检查控制台是否有异常

### 4.3 验收检查清单 (Acceptance Checklist)

- [ ] `dashboard.js` 中无直接AI调用代码
- [ ] 所有存储操作通过Service层进行
- [ ] Service函数有完整的JSDoc文档
- [ ] 错误处理机制正常工作
- [ ] 功能行为与拆分前完全一致
- [ ] 控制台无新的警告或错误

---

## 5. 接口定义示例

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
