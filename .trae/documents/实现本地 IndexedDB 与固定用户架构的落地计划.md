## 总览
- 目标：用 IndexedDB（Dexie）统一本地数据层，采用固定 `user_id=local-dev`，实现网站卡片、摘要（手动/日报）、订阅、地点的完整 CRUD 与 UI 同步，并预留未来云端迁移能力。
- 方针：保持现有 UI 行为与交互路径不变，替换数据源为 IndexedDB；将“手动生成”与“订阅生成”彻底分离，所有记录均包含 `user_id`。

## 数据层设计
- 新增模块：`js/storage/db.js`（Dexie 封装）
- 保留适配层：`js/storage/storageAdapter.js` 作为薄适配器，内部调用 Dexie，让现有页面最小改动。
- 固定开发者用户：启动时写入/校验 `user_id=local-dev`，对所有 CRUD 自动注入 `user_id`。

## 表结构（IndexedDB / Dexie）
- `websites`: `website_id(PK)`, `user_id`, `url`, `title`, `description`, `created_at`
- `digests`: `digest_id(PK)`, `user_id`, `website_id`, `summary`, `type('manual'|'daily')`, `created_at`
- `subscriptions`: `subscription_id(PK)`, `user_id`, `website_id`, `frequency('daily'|'weekly')`, `last_generated_at`
- `locations`: `location_id(PK)`, `user_id`, `name`, `address`, `lat`, `lng`, `description`, `created_at`
- 索引建议：
  - `websites`: `url+user_id`
  - `digests`: `website_id+type+created_at`
  - `subscriptions`: `website_id+user_id`

## 标准 CRUD API（对外保持稳定）
- Websites：`db.getWebsites()`, `db.createWebsite(data)`, `db.updateWebsite(id, patch)`, `db.deleteWebsite(id)`
- Digests：`db.getDigests()`, `db.createDigest(data)`, `db.updateDigest(id, patch)`, `db.deleteDigest(id)`
- Subscriptions：`db.getSubscriptions()`, `db.createSubscription(data)`, `db.updateSubscription(id, patch)`, `db.deleteSubscription(id)`
- Locations：`db.getLocations()`, `db.createLocation(data)`, `db.updateLocation(id, patch)`, `db.deleteLocation(id)`
- 事件：在适配器层继续 `subscribe/notify`，主题包括 `websites_changed`, `digests_changed`, `subscriptions_changed`, `user_changed`。

## 迁移策略（从 localStorage → IndexedDB）
- 数据来源键：`rune_cards`（网站）、`rune_digests`（摘要）、`rune_subscriptions`（订阅）等。
- 迁移步骤：
  1. 首次运行检查 Dexie 是否为空；为空则读取上述键。
  2. 逐条转换成新表结构，生成缺失的主键、补齐 `user_id=local-dev`、推导 `created_at`。
  3. 建立网站与订阅、摘要的外键关联（`website_id`）。
  4. 将“旧日志/合并字段”等保留到 `digests` 的 `type` 与 `created_at`。
  5. 迁移完成后，保留 localStorage 原数据一版备份键，避免重复迁移。

## 业务流程实现
- 3.1 添加网站：输入 URL → 抓取/AI → 写入 `websites` → 展示网站卡片。
- 3.2 手动摘要（Generate Now）：针对某网站写入 `digests` 一条，`type='manual'`。
- 3.3 日报订阅（Generate Today’s Digest）：
  - 订阅频率在 `subscriptions` 上配置；当日触发时生成 `digests` 一条，`type='daily'`。
  - 手动与日报次数分离统计（按 `type` 聚合）。
- 3.4 卡片管理：
  - 编辑：更新 `websites` 字段，通知 UI 刷新。
  - 删除网站：级联删除 `digests` 与 `subscriptions`（同 `website_id`）。

## UI 改造与状态同步
- 卡片状态仅两种：
  - 未订阅：显示 `Subscribe` 与 `Generate Now`
  - 已订阅：显示 `Generate Today’s Digest`（独立计数）
- 取消订阅：移至「Settings」界面，含确认 Modal；卡片菜单不再直接取消订阅。
- 数据来源：全部通过 `storageAdapter`（内部走 Dexie）读取，组件不再持久化状态。
- 订阅状态判定：以 `subscriptions` 是否存在该 `website_id` 为准。

## AI 服务抽象
- 新增模块：`js/services/ai.js`
  - `fetchSiteContent(url)`：抓取网页/Mock
  - `generateSummary(content)`：AI 生成摘要（本地开发走 Mock；未来切换云端）
  - `createDigestForWebsite(website, type)`：统一入口
- 保持与现有 `mockFunctions.js` 和云端回退逻辑兼容，避免破坏当前调试体验。

## 订阅与手动生成分离
- 计数：
  - `manualCount = count(digests where type='manual' and website_id)`
  - `dailyCount = count(digests where type='daily' and website_id)`
- UI 按上述计数分别展示。
- 冷却与限额（如有）：以 `type` 为维度分别计算。

## 验证与测试
- 单元测试：
  - CRUD：创建/更新/删除含 `user_id` 的记录正确性
  - 级联删除：删除网站后摘要与订阅清理
  - 迁移：localStorage → IndexedDB 的字段映射与数据完整性
- 手动验证：
  - 添加网站 → 生成手动摘要 → 订阅 → 生成日报摘要 → 取消订阅 → 删除网站
  - 刷新页面后 UI 与数据一致，无状态错乱。

## 未来云端对接预留
- Auth：所有记录已含 `user_id`，上线时只需替换来源。
- AI 服务：`js/services/ai.js` 切换到云端接口；保留本地回退。
- Cron：将本地“今日摘要触发”替换为云端定时任务。
- DB：表结构与字段命名与后端一致，支持无痛迁移。

## 交付项
- Dexie 封装与数据表创建
- `storageAdapter` 适配 IndexedDB 并保留事件总线
- 迁移脚本：localStorage → IndexedDB
- UI 改造：卡片、设置面板的订阅/生成按钮与状态
- AI 服务抽象模块
- 测试与验证脚本

请确认以上计划，确认后我将按此逐步实现并在代码中加入中文详细注释。