# 环境变量说明（ENV）

前端：
- `VITE_SUPABASE_URL`：Supabase 本地或云端 URL（如 `http://127.0.0.1:65432`）。
- `VITE_SUPABASE_ANON_KEY`：Supabase Anon Key（前端唯一可用的 key）。

说明：
- 不允许在前端持有 `service_role_key`（安全规范）。
- 所有 Edge Functions 与 REST 请求都必须附带 `Authorization: Bearer <JWT>`。

校验：
- 初始化时调用 `config.validate()`，缺少上述变量立即报错。
