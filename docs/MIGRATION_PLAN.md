# 云端迁移策略 (Migration Plan)

本底主要描述如何将本地 IndexedDB 数据无缝迁移至 Supabase Postgres。

## 1. 数据库模式映射 (Schema Mapping)

### 1.1 Links (IndexedDB `websites`) -> Postgres `public.links`

| IndexedDB Field | Postgres Column | Type | Notes |
| :--- | :--- | :--- | :--- |
| `website_id` (AutoInc) | `id` | `bigint` | Primary Key |
| `user_id` | `user_id` | `uuid` | Foreign Key -> `auth.users` |
| `url` | `url` | `text` | Unique (per user) |
| `title` | `title` | `text` | |
| `category` | `category` | `text` | |
| `tags` | `tags` | `text[]` | Array |
| `created_at` | `created_at` | `timestamptz` | |

### 1.2 Digests (IndexedDB `digests`) -> Postgres `public.digests`

| IndexedDB Field | Postgres Column | Type | Notes |
| :--- | :--- | :--- | :--- |
| `digest_id` | `id` | `bigint` | Primary Key |
| `website_id` | `link_id` | `bigint` | FK -> `links.id` |
| `summary` | `summary` | `text` | |
| `type` | `type` | `text` | 'manual' / 'daily' |
| `created_at` | `created_at` | `timestamptz` | |

## 2. 迁移流程 (Migration Workflow)

### Step 1: 用户登录与关联
用户在前端登录 Supabase 后，系统获得 `user_id`。

### Step 2: 数据扫描与上传
前端触发迁移脚本：
1.  读取 IndexedDB 所有 `websites`。
2.  读取 IndexedDB 所有 `digests`。
3.  **Conflict Resolution**:
    *   如果云端已存在相同 URL，以云端为准（或提示用户合并）。
    *   如果云端无此数据，执行 `INSERT`。

### Step 3: 标记迁移完成
在 `localStorage` 设置 `cloud_sync_status = 'synced'`，后续操作直接走 API。

## 3. 兼容性策略 (Compatibility)

为了支持离线访问和老版本兼容：
*   **双写策略 (Double Write)**: 在迁移过渡期，前端写入操作同时写入 IndexedDB 和 Cloud API。
*   **回滚方案**: 如果云端同步失败，UI 降级为 "Offline Mode"，数据暂存 IndexedDB，待网络恢复后重试。

## 4. 代码变更点
*   `storageAdapter.js`: 需要改造为根据 `useCloud` 标志位动态切换数据源。
    ```javascript
    // 伪代码
    async getLinks() {
      if (this.useCloud) {
        return await supabase.from('links').select('*');
      }
      return await db.websites.getAll();
    }
    ```
