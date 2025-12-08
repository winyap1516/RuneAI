# 环境变量说明（Auth/OAuth/Email）

## 前端（Vite）
- VITE_SUPABASE_URL：Supabase 项目 URL
- VITE_SUPABASE_ANON_KEY：Supabase 匿名 Key
- VITE_FRONTEND_BASE_URL：前端站点基址（用于 Redirect，例如 http://localhost:5173）
- VITE_STRIPE_PUBLIC_KEY：Stripe 公钥（如有）

## 后端 / Edge Functions
- SUPABASE_URL：Supabase 项目 URL
- SUPABASE_SERVICE_ROLE_KEY：Service Role Key（仅后端持有）
- STRIPE_SECRET_KEY：Stripe Secret（仅后端）
- STRIPE_WEBHOOK_SECRET：Stripe Webhook Secret（仅后端）
- FRONTEND_BASE_URL：前端站点基址（Checkout 成功/取消回跳）

## 账号恢复与邮件服务（生产）
- EMAIL_PROVIDER：邮件服务商（`sendgrid` | `mailgun` | `ses`）
- EMAIL_API_KEY：邮件服务 API Key（仅后端持有）
- EMAIL_FROM：发信地址（如 `no-reply@yourdomain.com`）
- EMAIL_FROM_NAME：可选，显示发信人名称（默认 `Rune`）
- （若使用 Mailgun）MAILGUN_DOMAIN：域名（如 `mg.yourdomain.com`）
- OAUTH_STATE_SECRET：OAuth state 防篡改密钥（仅后端）

## 恢复流程相关（Edge Functions）
- SUPABASE_URL：同上
- SUPABASE_SERVICE_ROLE_KEY：同上（仅后端）
- FRONTEND_BASE_URL：同上（用于恢复流程跳转到 `set-password.html`）

### Dev 模式说明
- 开发环境无需真实发信：恢复接口返回 `preview_link` 用于联调预览，不触发实际邮件。
- 请勿在前端代码中引用 `Service Role Key` 或任何后端密钥。

## Supabase 控制台配置（Authentication → Settings）
- 开启 Email confirmations
- Redirect URLs：
  - http://localhost:5173
  - （可选）http://localhost:5173/login.html（如使用独立登录页）
  - http://localhost:5173/reset-password.html
  - 生产域名（如 https://app.yourdomain.com）
- Providers → Google：在 GCP 创建 OAuth Client，填入 Client ID/Secret；Authorized redirect URIs：
  - https://<YOUR-PROJECT>.supabase.co/auth/v1/callback
  - http://localhost:5173
  - （如独立页）http://localhost:5173/login.html

## 注意
- 前端不暴露 Service Role Key；所有敏感操作在 Edge Functions 内执行。
- OAuth 重定向域必须与控制台设置一致。
