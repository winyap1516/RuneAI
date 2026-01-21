# 代码模块蓝图 (Code Module Blueprint)

## 前端

### linkController（木｜君）
- 路径：`src/js/controllers/linkController.js`
- 职责：新增/更新/删除、AI 触发、云端同步（SDK→EdgeFn 回退）
- 输入/输出：`addLink(rawUrl)`、`updateLink(id, patch)`、`deleteLink(id)`、`generateAI(id)`
- 依赖：`storageAdapter`、`supabaseClient`、`config`、`logger`
- 被谁调用：`linksView.js`、Dashboard

### linksView（木｜佐）
- 路径：`src/js/views/linksView.js`
- 职责：渲染卡片列表、AI 状态局部刷新、订阅按钮逻辑、编辑/删除表单交互
- 输入/输出：`renderLinks(links)`、`updateAIStatus(id, status, data)`、`toggleSubscriptionUI(id, isSubscribed)`
- 依赖：`card.js` (template)、`ui-helpers.js`
- 被谁调用：`linkController.js`、Dashboard

### card（木｜佐）
- 路径：`src/js/templates/card.js`
- 职责：生成卡片 HTML、data 属性埋点（用于 AI 状态更新）
- 输入/输出：`renderCard(link)`
- 依赖：`ui-helpers.js` (escapeHtml, formatDate)
- 被谁调用：`linksView.js`

### ui-helpers（水｜使）
- 路径：`src/js/utils/ui-helpers.js`
- 职责：通用 UI 工具（favicon 回退、日期格式化、防抖）
- 输入/输出：`buildIconHTML(url)`、`debounce(fn, delay)`
- 依赖：无
- 被谁调用：Views, Templates

### supabaseClient（金｜使）
- 路径：`src/js/services/supabaseClient.js`
- 职责：Supabase 客户端初始化、Auth 头注入、Function 调用封装
- 输入/输出：`callFunction(name, options)`、`supabase` 实例
- 依赖：`@supabase/supabase-js`、`config`
- 被谁调用：Controllers, Services

### storageAdapter（土｜使）
- 路径：`src/js/storage/storageAdapter.js`
- 职责：IndexedDB 读写封装、本地数据持久化
- 输入/输出：`saveLink(link)`、`getLinks()`、`deleteLink(id)`
- 依赖：`idb` (or similar wrapper)
- 被谁调用：Controllers

## 后端 (Edge Functions)

### update-link
- 路径：`supabase/functions/update-link/index.ts`
- 职责：后端更新链接（支持 ai_status），绕过前端 RLS 限制（作为回退）
- 依赖：`supabase-js` (Service Role)

### delete-link
- 路径：`supabase/functions/delete-link/index.ts`
- 职责：后端删除链接，绕过前端 RLS 限制（作为回退）
- 依赖：`supabase-js` (Service Role)

### super-endpoint
- 路径：`supabase/functions/super-endpoint/index.ts`
- 职责：AI 摘要生成、元数据抓取
- 依赖：`openai`、`cheerio` (optional)

### sync-push
- 路径：`supabase/functions/sync-push/index.ts`
- 职责：批量接收客户端变更日志，执行幂等写入
- 依赖：`supabase-js` (RPC or direct DB access)

### sync-pull
- 路径：`supabase/functions/sync-pull/index.ts`
- 职责：聚合 websites/subscriptions/digests 等数据返回给客户端
- 依赖：`supabase-js`
