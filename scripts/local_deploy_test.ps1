<#
.SYNOPSIS
    Phase 4 本地自动化部署与联调脚本 (Full Version - Fixed SQL Deploy)
.DESCRIPTION
    1. 启动 Supabase (Docker)
    2. 获取 Keys
    3. 部署数据库 Schema & RPC (via db reset)
    4. 启动 Edge Functions (本地 Serve)
    5. 启动前端
    6. 执行验证脚本
    7. 收集日志
#>

$ErrorActionPreference = "Continue"
$LogDir = "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

Write-Host "🚀 [Step 1] Checking Prerequisites..." -ForegroundColor Cyan

# Check Docker
try {
    docker info > $null
    Write-Host "✅ Docker is running." -ForegroundColor Green
} catch {
    Write-Error "❌ Docker is NOT running."
    exit 1
}

# Determine Supabase Command
$SupabaseCmd = "supabase"
if (-not (Get-Command "supabase" -ErrorAction SilentlyContinue)) {
    $SupabaseCmd = "npx supabase"
}
Write-Host "✅ Using Supabase command: $SupabaseCmd" -ForegroundColor Green

Write-Host "`n🚀 [Step 2] Starting Local Supabase..." -ForegroundColor Cyan
# Stop first to ensure clean state
Invoke-Expression "$SupabaseCmd stop" > $null 2>&1
Invoke-Expression "$SupabaseCmd start"

# Check status
try {
    Invoke-Expression "$SupabaseCmd status" > "$LogDir/supabase_status.log" 2>&1
    Write-Host "✅ Supabase started." -ForegroundColor Green
} catch {
    Write-Warning "⚠️ Issue getting status. Checking logs..."
}

# Extract Keys from supabase status
$StatusOutput = Get-Content "$LogDir/supabase_status.log" -Raw
$AnonKey = $null
$ServiceKey = $null
$ApiUrl = "http://localhost:65421"

if ($StatusOutput -match "anon key: (.*)") { $AnonKey = $matches[1].Trim() }
if ($StatusOutput -match "service_role key: (.*)") { $ServiceKey = $matches[1].Trim() }

if (-not $AnonKey -or -not $ServiceKey) {
    try {
        Invoke-Expression "$SupabaseCmd status -o json" > "$LogDir/supabase_status.json"
        $JsonStatus = Get-Content "$LogDir/supabase_status.json" | ConvertFrom-Json
        $AnonKey = $JsonStatus.anon_key
        $ServiceKey = $JsonStatus.service_role_key
        $ApiUrl = $JsonStatus.api_url
    } catch {
        Write-Error "❌ Failed to extract keys."
    }
}

Write-Host "   API URL: $ApiUrl"
Write-Host "   Anon Key: $(if ($AnonKey) {'Found'} else {'Missing'})"

Write-Host "`n🚀 [Step 3] Deploying Database Schema..." -ForegroundColor Cyan
try {
    # Copy deploy_all.sql to migrations folder with timestamp to be picked up by db reset
    $MigrationFile = "supabase/migrations/20250101000000_phase4_init.sql"
    Copy-Item "supabase/migrations/phase4/deploy_all.sql" -Destination $MigrationFile -Force
    
    # Run db reset to apply migrations
    # --no-backup prevents backing up the current (empty/broken) db
    Invoke-Expression "$SupabaseCmd db reset --no-backup" > "$LogDir/deploy_sql.log" 2>&1
    
    if (Select-String -Path "$LogDir/deploy_sql.log" -Pattern "error" -Quiet) {
        Write-Warning "⚠️ Potential errors in SQL deployment. Check logs."
    } else {
        Write-Host "✅ Database schema deployed (via migrations)." -ForegroundColor Green
    }
} catch {
    Write-Error "❌ Failed to deploy schema."
}

Write-Host "`n🚀 [Step 4] Serving Edge Functions..." -ForegroundColor Cyan
Get-Process -Name "deno" -ErrorAction SilentlyContinue | Stop-Process -Force

$PushLog = "$PWD/$LogDir/func_sync_push.log"
$PullLog = "$PWD/$LogDir/func_sync_pull.log"

$JobScript = {
    param($Cmd, $Func, $Log)
    Set-Location $using:PWD
    Invoke-Expression "$Cmd functions serve $Func --no-verify-jwt" > $Log 2>&1
}

$PushJob = Start-Job -ScriptBlock $JobScript -ArgumentList $SupabaseCmd, "sync-push", $PushLog
Write-Host "   - sync-push serving..."

$PullJob = Start-Job -ScriptBlock $JobScript -ArgumentList $SupabaseCmd, "sync-pull", $PullLog
Write-Host "   - sync-pull serving..."

Start-Sleep -Seconds 10

Write-Host "`n🚀 [Step 5] Configuring Environment..." -ForegroundColor Cyan
$EnvContent = @"
VITE_SUPABASE_URL=$ApiUrl
VITE_SUPABASE_ANON_KEY=$AnonKey
SUPABASE_SERVICE_ROLE_KEY=$ServiceKey
"@
Set-Content ".env.local" $EnvContent
Write-Host "✅ .env.local created." -ForegroundColor Green

Write-Host "`n🚀 [Step 6] Starting Frontend..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules")) { npm install > $null 2>&1 }

$FrontendProcess = Start-Process -FilePath "cmd" -ArgumentList "/c npm run dev" -PassThru -RedirectStandardOutput "$LogDir/frontend_dev.log" -RedirectStandardError "$LogDir/frontend_dev.err"
Write-Host "✅ Frontend started (PID: $($FrontendProcess.Id))." -ForegroundColor Green

Start-Sleep -Seconds 5

Write-Host "`n🚀 [Step 7] Running Verification Script..." -ForegroundColor Cyan
$env:VITE_SUPABASE_URL = $ApiUrl
$env:VITE_SUPABASE_ANON_KEY = $AnonKey
$env:SUPABASE_SERVICE_ROLE_KEY = $ServiceKey

try {
    if (-not (Test-Path "node_modules/@supabase/supabase-js")) {
        npm install dotenv @supabase/supabase-js --no-audit --no-fund > $null 2>&1
    }
    node scripts/verify_phase4.js | Tee-Object -FilePath "$LogDir/verify_phase4.log"
    Write-Host "`n✅ Verification script finished." -ForegroundColor Green
} catch {
    Write-Host "`n❌ Verification script FAILED." -ForegroundColor Red
}

Write-Host "`n🚀 [Step 8] Cleanup..." -ForegroundColor Cyan
Stop-Process -Id $FrontendProcess.Id -Force -ErrorAction SilentlyContinue
Stop-Job $PushJob
Stop-Job $PullJob
Invoke-Expression "$SupabaseCmd stop" > $null 2>&1

# Clean up migration file to not pollute repo
Remove-Item $MigrationFile -ErrorAction SilentlyContinue

Write-Host "`n✨ All Done! Check $LogDir/ for detailed logs." -ForegroundColor Cyan
