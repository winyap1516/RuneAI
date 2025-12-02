<#
.SYNOPSIS
    Phase 4 本地自动化部署与联调脚本 (Part 2 - Post Start)
.DESCRIPTION
    假设 Supabase 已启动，执行后续步骤：
    1. 获取 Keys
    2. 部署数据库 Schema & RPC
    3. 启动 Edge Functions (本地 Serve)
    4. 启动前端
    5. 执行验证脚本
    6. 收集日志
#>

$ErrorActionPreference = "Continue" # Relax error checking
$LogDir = "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

# Determine Supabase Command
$SupabaseCmd = "supabase"
if (-not (Get-Command "supabase" -ErrorAction SilentlyContinue)) {
    $SupabaseCmd = "npx supabase"
}
Write-Host "✅ Using Supabase command: $SupabaseCmd" -ForegroundColor Green

Write-Host "`n🚀 [Step 2.5] Checking Supabase Status..." -ForegroundColor Cyan
try {
    Invoke-Expression "$SupabaseCmd status" > "$LogDir/supabase_status.log" 2>&1
    Write-Host "✅ Supabase status retrieved." -ForegroundColor Green
} catch {
    Write-Warning "⚠️ Could not get status directly. Trying JSON..."
}

# Extract Keys from supabase status
$StatusOutput = Get-Content "$LogDir/supabase_status.log" -Raw
$AnonKey = $null
$ServiceKey = $null
$ApiUrl = "http://localhost:65421" # Default per config.toml change

if ($StatusOutput -match "anon key: (.*)") { $AnonKey = $matches[1].Trim() }
if ($StatusOutput -match "service_role key: (.*)") { $ServiceKey = $matches[1].Trim() }

if (-not $AnonKey -or -not $ServiceKey) {
    # Fallback: Try json output if text parsing failed
    try {
        Invoke-Expression "$SupabaseCmd status -o json" > "$LogDir/supabase_status.json"
        $JsonStatus = Get-Content "$LogDir/supabase_status.json" | ConvertFrom-Json
        $AnonKey = $JsonStatus.anon_key
        $ServiceKey = $JsonStatus.service_role_key
        $ApiUrl = $JsonStatus.api_url
    } catch {
        Write-Error "❌ Failed to extract keys from supabase status."
    }
}

Write-Host "   API URL: $ApiUrl"
Write-Host "   Anon Key: $(if ($AnonKey) {'Found'} else {'Missing'})"
Write-Host "   Service Key: $(if ($ServiceKey) {'Found'} else {'Missing'})"

Write-Host "`n🚀 [Step 3] Deploying Database Schema..." -ForegroundColor Cyan
# Deploy SQL using supabase db query
try {
    $SqlFile = "supabase/migrations/phase4/deploy_all.sql"
    # Use cmd /c to handle piping correctly for npx/supabase in PowerShell because Invoke-Expression pipe is flaky
    # Also use Get-Content -Raw to ensure full content
    $AbsSqlPath = (Resolve-Path $SqlFile).Path
    
    # Construct command string carefully for PowerShell
    # We use cmd /c to pipe file content into the supabase command
    $CmdStr = "cmd /c ""type `"$AbsSqlPath`" | $SupabaseCmd db query"""
    Invoke-Expression $CmdStr > "$LogDir/deploy_sql.log" 2>&1
    
    Write-Host "✅ Database schema deployed." -ForegroundColor Green
} catch {
    Write-Error "❌ Failed to deploy schema. Check $LogDir/deploy_sql.log"
}

Write-Host "`n🚀 [Step 4] Serving Edge Functions..." -ForegroundColor Cyan
# Kill existing deno
Get-Process -Name "deno" -ErrorAction SilentlyContinue | Stop-Process -Force

# Serve sync-push
$PushLog = "$PWD/$LogDir/func_sync_push.log"
$PullLog = "$PWD/$LogDir/func_sync_pull.log"

$JobScript = {
    param($Cmd, $Func, $Log)
    Set-Location $using:PWD
    # Use --no-verify-jwt to allow our script to handle auth or skip it for local dev
    Invoke-Expression "$Cmd functions serve $Func --no-verify-jwt" > $Log 2>&1
}

$PushJob = Start-Job -ScriptBlock $JobScript -ArgumentList $SupabaseCmd, "sync-push", $PushLog
Write-Host "   - sync-push serving..."

$PullJob = Start-Job -ScriptBlock $JobScript -ArgumentList $SupabaseCmd, "sync-pull", $PullLog
Write-Host "   - sync-pull serving..."

Start-Sleep -Seconds 10 # Wait for functions to warm up

Write-Host "`n🚀 [Step 5] Configuring Environment..." -ForegroundColor Cyan
$EnvContent = @"
VITE_SUPABASE_URL=$ApiUrl
VITE_SUPABASE_ANON_KEY=$AnonKey
SUPABASE_SERVICE_ROLE_KEY=$ServiceKey
"@
Set-Content ".env.local" $EnvContent
Write-Host "✅ .env.local created." -ForegroundColor Green

Write-Host "`n🚀 [Step 6] Starting Frontend..." -ForegroundColor Cyan
# Install dependencies first
if (-not (Test-Path "node_modules")) {
    npm install > $null 2>&1
}
$FrontendProcess = Start-Process -FilePath "npm" -ArgumentList "run dev" -PassThru -RedirectStandardOutput "$LogDir/frontend_dev.log" -RedirectStandardError "$LogDir/frontend_dev.err"
Write-Host "✅ Frontend started (PID: $($FrontendProcess.Id))." -ForegroundColor Green

Start-Sleep -Seconds 5

Write-Host "`n🚀 [Step 7] Running Verification Script..." -ForegroundColor Cyan
# Set env vars for current session
$env:VITE_SUPABASE_URL = $ApiUrl
$env:VITE_SUPABASE_ANON_KEY = $AnonKey
$env:SUPABASE_SERVICE_ROLE_KEY = $ServiceKey

try {
    # Install node dependencies for script (dotenv, @supabase/supabase-js)
    if (-not (Test-Path "node_modules/@supabase/supabase-js")) {
        npm install dotenv @supabase/supabase-js --no-audit --no-fund > $null 2>&1
    }
    
    node scripts/verify_phase4.js | Tee-Object -FilePath "$LogDir/verify_phase4.log"
    Write-Host "`n✅ Verification script finished." -ForegroundColor Green
} catch {
    Write-Host "`n❌ Verification script FAILED." -ForegroundColor Red
}

Write-Host "`n🚀 [Step 8] Cleanup..." -ForegroundColor Cyan
Write-Host "   - Stopping frontend..."
Stop-Process -Id $FrontendProcess.Id -Force -ErrorAction SilentlyContinue
Write-Host "   - Stopping functions (jobs)..."
Stop-Job $PushJob
Stop-Job $PullJob
Write-Host "   - Stopping Supabase..."
Invoke-Expression "$SupabaseCmd stop" > $null 2>&1

Write-Host "`n✨ All Done! Check $LogDir/ for detailed logs." -ForegroundColor Cyan
