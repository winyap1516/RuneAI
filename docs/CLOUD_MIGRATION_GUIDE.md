# 云端迁移指南（停用本地 Supabase Docker）

## 目标
- 前端继续在 `http://localhost:5173` 开发；后端（Auth/DB/Storage/Edge）全面迁移至 Supabase 云端。
- 移除/停用本地 Docker 与本地 `supabase functions serve`。

## 步骤

1. 配置前端环境变量（.env.local）
   - `VITE_SUPABASE_URL=https://xxxx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=<cloud anon key>`
   - `VITE_FRONTEND_BASE_URL=http://localhost:5173`

2. 更新 Supabase 控制台 Redirect URLs（Authentication → Settings）
   - 填入 login/register/signup/reset/set-password/account-recovery/confirm 等完整列表（见 ENV.md）。

3. 前端调用云端 Edge Functions
   - 统一使用 `SUPABASE_URL/functions/v1/<name>` 路径，并附带：
     - `Authorization: Bearer <JWT>`（`supabase.auth.getSession()` 获取）
     - `apikey: <anon key>`

4. 停用本地服务
   - 不再运行 `supabase functions serve`；`package.json` 已移除相关脚本。
   - 如有 Docker 进程，建议手动停止并删除。

## 数据迁移（可选）

### 方案 A：新建云端数据库（推荐）
- 直接使用云端全新数据库与 `migrations/` 的结构，不迁移本地数据。

### 方案 B：选择性迁移业务表
- 迁移表：`websites`、`categories`、`user_settings` 等业务数据。
- 做法：
  1. 本地导出为 CSV（示例 SQL）：
     ```sql
     -- 中文注释：在本地数据库导出为 CSV（路径与权限需按环境调整）
     COPY public.websites TO '/tmp/websites.csv' WITH (FORMAT csv, HEADER true);
     COPY public.categories TO '/tmp/categories.csv' WITH (FORMAT csv, HEADER true);
     COPY public.user_settings TO '/tmp/user_settings.csv' WITH (FORMAT csv, HEADER true);
     ```
  2. 云端导入（通过 SQL Editor 或 psql）：
     ```sql
     -- 中文注释：在云端导入 CSV 到对应表（需先创建表与列一致的结构）
     COPY public.websites FROM '/tmp/websites.csv' WITH (FORMAT csv, HEADER true);
     COPY public.categories FROM '/tmp/categories.csv' WITH (FORMAT csv, HEADER true);
     COPY public.user_settings FROM '/tmp/user_settings.csv' WITH (FORMAT csv, HEADER true);
     ```
- 注意：
  - 不要覆盖系统表（`auth.users` 等）。
  - 保持 `user_id` 与 RLS 策略一致；必要时在迁移前填充/映射 `user_id`。

## 验证与调试
- 在登录页与 Dashboard 执行一次 `preflightAuth()`（`supabaseClient.preflightAuth`）确认云端 `SUPABASE_URL` 与 `anon key` 生效。
- 触发 `super-endpoint`、`sync-push`、`sync-pull` 并检查网络请求目标为 `https://xxxx.supabase.co/functions/v1/*`。

## 常见问题
- 401/403：检查是否附带 `Authorization: Bearer <JWT>`；确认邮箱已验证与角色权限正确。
- 404：确认函数已在云端部署，并在 `SUPABASE_URL/functions/v1/<name>` 路径下可访问。
- CORS：使用 Supabase 默认域名与内置 CORS 设置；不要通过自建反向代理。

