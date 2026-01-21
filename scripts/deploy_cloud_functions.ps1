# 中文注释：一键部署 Supabase Edge Functions 与 Secrets 配置脚本
# 作用：自动设置 Secrets 并批量部署函数，省去手动逐个敲命令的麻烦
# 用法：在 PowerShell 中执行 ./deploy_cloud_functions.ps1

$ErrorActionPreference = "Stop"

# 1. 配置项目信息（请确认）
$PROJECT_REF = "oxtmsuxtlpbkzunumyou"
$SUPABASE_URL = "https://oxtmsuxtlpbkzunumyou.supabase.co"
$FRONTEND_URL = "http://localhost:5173"

# 2. 提示用户输入敏感信息（不硬编码在脚本里）
Write-Host "正在准备部署到项目: $PROJECT_REF" -ForegroundColor Cyan
$SERVICE_KEY = Read-Host "请输入 SUPABASE_SERVICE_ROLE_KEY (从控制台复制)"
if ([string]::IsNullOrWhiteSpace($SERVICE_KEY)) { Write-Error "必须提供 Service Role Key"; exit 1 }

$OPENAI_KEY = Read-Host "请输入 OPENAI_API_KEY (留空则不设置)"
$OPENAI_BASE = Read-Host "请输入 OPENAI_BASE_URL (留空默认 https://api.openai.com)"

# 3. 设置 Secrets
Write-Host "`n[1/2] 正在设置 Secrets..." -ForegroundColor Yellow
$secrets = @(
    "SUPABASE_URL=$SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY",
    "FRONTEND_BASE_URL=$FRONTEND_URL",
    "ENV=prod"
)
if (-not [string]::IsNullOrWhiteSpace($OPENAI_KEY)) {
    $secrets += "OPENAI_API_KEY=$OPENAI_KEY"
    $secrets += "OPENAI_MODEL=gpt-4o-mini"
    $secrets += "DEV_MOCK_OPENAI=false"
}
if (-not [string]::IsNullOrWhiteSpace($OPENAI_BASE)) {
    $secrets += "OPENAI_BASE_URL=$OPENAI_BASE"
}

# 执行设置
cmd /c "supabase secrets set --project-ref $PROJECT_REF $secrets"

# 4. 批量部署函数
Write-Host "`n[2/2] 正在批量部署函数..." -ForegroundColor Yellow
$functions = Get-ChildItem "supabase/functions" -Directory
foreach ($fn in $functions) {
    Write-Host "  -> Deploying $($fn.Name)..." -NoNewline
    try {
        cmd /c "supabase functions deploy $($fn.Name) --project-ref $PROJECT_REF --no-verify-jwt" 2>&1 | Out-Null
        Write-Host " [OK]" -ForegroundColor Green
    } catch {
        Write-Host " [FAILED]" -ForegroundColor Red
        Write-Error $_
    }
}

Write-Host "`n部署完成！请在浏览器 http://localhost:5173 测试。" -ForegroundColor Green
