# Phase 3 — 性能与规模化优化计划

## 总体目标
让UI在大量数据下（500 → 10,000条）依然流畅，重点放在局部渲染、分页、虚拟滚动、IndexedDB分页查询。

## PR任务拆分

### PR-A — 增量渲染接口（Partial Update）
**Branch:** `feat/phase3-partial-update`

**目标/Scope:**
- 在`js/views/linksView.js`加入`updateSingleCardUI(id, data)`接口
- Controller增删改逻辑中调用该接口替代整个列表重渲染
- 验收标准：修改单条数据后页面无闪烁，仅目标卡片DOM更新

**Estimate:** 0.5 day

### PR-B — IndexedDB分页查询（Adapter + Controller支持）
**Branch:** `feat/phase3-db-pagination`

**目标/Scope:**
- 在`js/storage/db.js`/`storageAdapter`新增分页API：
  - `getLinksPage(offset, limit)`
  - `getDigestsPage(offset, limit)`
- Controller使用分页API减少内存占用
- 验收标准：1000条数据时仅加载第一页（limit=50），UI正常显示并能翻页

**Estimate:** 1 day

### PR-C — 虚拟列表（Virtual Scrolling）
**Branch:** `feat/phase3-virtual-scroll`

**目标/Scope:**
- 为Links列表实现虚拟滚动（或按需惰性渲染）
- 与分页API协同工作
- 验收标准：1000条数据时滚动不卡顿、首屏渲染时间显著下降

**Estimate:** 1–2 days

### PR-D — 图片/资源懒加载 + 首屏优化
**Branch:** `feat/phase3-lazy-assets`

**目标/Scope:**
- 给卡片头像/favicon/图片加入lazy loading
- 优化首次渲染（render首屏50条优先渲染）
- 验收标准：Lighthouse首屏渲染时间下降/图片网络请求按需发出

**Estimate:** 0.5 day

## 架构守护者审查要点

### 必须核查项
- **Partial Update：** 没有副作用、事件委托不被破坏
- **DB分页：** 接口返回形态一致、兼容现有Controller
- **虚拟列表：** 不会损坏局部更新API，测试内存占用明显降低
- **兼容性：** 在主流浏览器（Chrome/Edge）测试通过
- **文档：** 更新MODULE_SPLIT.md中Phase 3计划与PR状态

### QA/性能验收标准
- **稳定性：** 关键路径（Generate/CRUD/Subscription）无未捕获异常
- **性能：** 500条数据场景下，首屏渲染<1s；滚动无掉帧
- **内存：** 与当前实现相比内存占用应明显下降（可用浏览器task manager比对）

## 时间规划
- **Phase 3总估时：** 3-4天
- **每个PR独立可验收，可并行开发**
- **完成后进入Phase 4（云端迁移准备）**