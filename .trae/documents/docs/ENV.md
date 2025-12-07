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
