# 环境变量与机密配置 (Environment Variables & Secrets)

## 前端（Vite）
配置于 `.env` 文件，构建时注入。
- `VITE_SUPABASE_URL`（必需）：Supabase 项目 URL
- `VITE_SUPABASE_ANON_KEY`（必需）：公开 Anon Key（前端只读或受限写）
- `VITE_FRONTEND_BASE_URL`（必需）：前端部署地址（用于回调、重定向）
- `VITE_ENV`（可选）：`dev` 或 `prod`，用于控制 Mock/调试行为

## 后端（Supabase Edge Functions）
配置于 Supabase Dashboard 或 CLI Secrets。
- `SUPABASE_URL`（系统预设）：项目 URL
- `SUPABASE_SERVICE_ROLE_KEY`（系统预设）：Service Role Key（绕过 RLS，慎用）
- `SUPABASE_ANON_KEY`（系统预设）：Anon Key
- `OPENAI_API_KEY`（必需）：用于 `super-endpoint` 生成摘要
- `EMAIL_PROVIDER`（必需）：`sendgrid` | `mailgun` | `ses`
- `EMAIL_API_KEY`（必需）：邮件服务 API Key
- `EMAIL_FROM`（必需）：发件人地址

## 配置规则
1. **禁止硬编码**：URL、Keys 必须从 `import.meta.env` (Vite) 或 `Deno.env` (EdgeFn) 读取。
2. **敏感信息**：`SERVICE_ROLE_KEY`、`OPENAI_API_KEY`、`EMAIL_API_KEY` 严禁出现在前端代码或 Git 中。
3. **校验**：前端启动时通过 `src/js/services/config.js` 校验必需变量；缺失则抛错。
4. **同步**：新增变量需同步更新本文件与 Supabase Dashboard。
