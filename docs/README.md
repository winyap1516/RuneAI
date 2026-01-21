# RuneAI - 智能链接收集与摘要系统

## 快速开始 (Quick Start)

### 安装与运行
```bash
npm install
npm run dev
# 访问 http://localhost:5173
```

### 登录与测试
1. 打开 `http://localhost:5173/login.html`
2. 使用测试账号或注册新账号（开发环境需配置邮件服务或查看 Console 预览链接）
3. 登录后自动跳转 Dashboard，即可添加链接测试 AI 生成。

### 常用命令
- `npm run dev`：启动 Vite 开发服务器
- `npm run build`：构建生产版本
- `npm run preview`：预览构建产物

## 联调指南 (Debugging)

### 获取 JWT
在浏览器控制台输入：
```javascript
(await supabase.auth.getSession()).data.session.access_token
```

### PowerShell 联调 Edge Function
```powershell
$token = "<JWT>"
$anon  = "<VITE_SUPABASE_ANON_KEY>"
$headers = @{ Authorization = "Bearer $token"; apikey = $anon; 'Content-Type'='application/json' }

# 更新链接（含 ai_status）
Invoke-RestMethod -Method POST -Uri "https://<project-ref>.supabase.co/functions/v1/update-link" -Headers $headers -Body (@{ url="github.com"; ai_status="completed" } | ConvertTo-Json)

# 删除链接
Invoke-RestMethod -Method POST -Uri "https://<project-ref>.supabase.co/functions/v1/delete-link" -Headers $headers -Body (@{ url="github.com" } | ConvertTo-Json)
```

## 常见问题 (FAQ)
- **Q: AI 状态一直 Pending？**
  - A: 检查 `super-endpoint` 是否部署，或 OpenAI Key 是否配置。本地开发需使用 `supabase functions serve`。
- **Q: 无法删除链接？**
  - A: 检查 RLS 策略或尝试使用 Edge Function 回退逻辑。
- **Q: 样式加载失败？**
  - A: 确保 `src/css/output.css` 存在（Tailwind 构建）。
