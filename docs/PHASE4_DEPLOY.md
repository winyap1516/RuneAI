# Phase 4 部署与验证指南

## 1. 数据库部署 (Schema & RPC)

由于本地未检测到 Supabase CLI，请按照以下步骤在 Supabase Dashboard 手动执行 SQL：

1.  登录 [Supabase Dashboard](https://supabase.com/dashboard)。
2.  进入你的项目 -> **SQL Editor**。
3.  点击 **New Query**。
4.  复制本地文件 `supabase/migrations/phase4/deploy_all.sql` 的全部内容。
5.  粘贴到 SQL Editor 并点击 **Run**。
    *   ✅ 成功标志：无报错，右下角显示 `Success`。

## 2. Edge Functions 部署

请在拥有 Supabase CLI 的环境（或 CI/CD）中执行以下命令部署 Functions：

```bash
# 登录 (仅首次)
supabase login

# 部署 sync-push
supabase functions deploy sync-push --no-verify-jwt

# 部署 sync-pull
supabase functions deploy sync-pull --no-verify-jwt
```

> **注意**: 我们使用 `--no-verify-jwt` 是因为我们在代码内部通过 `supabase.auth.getUser(jwt)` 手动验证了 Token，以获取更详细的用户信息和控制权。如果希望由网关层验证，可移除该参数并在 Dashboard 设置 "Enforce JWT"。

## 3. 环境变量配置

请将项目根目录下的 `.env` 文件补充完整：

```ini
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... (从 Dashboard -> Settings -> API 获取)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## 4. 自动化验证

在完成上述步骤后，运行以下脚本进行端到端验证：

```bash
# 安装依赖 (仅首次)
npm install @supabase/supabase-js dotenv

# 运行验证脚本
node scripts/verify_phase4.js
```

该脚本将自动执行：
1.  创建一个临时测试用户。
2.  验证 RLS（尝试直接写入）。
3.  调用 `/sync-push` 模拟客户端创建链接（验证事务与 ID 返回）。
4.  再次调用 `/sync-push` 验证幂等性（Client Change ID 去重）。
5.  调用 `/sync-push` 模拟更新（验证冲突检测逻辑）。
6.  调用 `/sync-pull` 验证多资源返回格式。
7.  清理测试用户。

## 5. 手动验证清单

- [ ] **RLS**: 在 Dashboard Table Editor 中查看 `client_changes` 表，确认 `user_id` 列已正确填充。
- [ ] **Unique**: 尝试手动插入重复 `client_change_id`，应报错。
- [ ] **Logs**: 在 Dashboard -> Edge Functions -> Logs 中查看函数调用日志。
