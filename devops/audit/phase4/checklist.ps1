<#
.SYNOPSIS
    Phase 4 快速检查清单 (Checklist)
.DESCRIPTION
    一键运行，确认环境健康状态。
#>

$ErrorActionPreference = "Continue"

Write-Host "📋 Phase 4 Health Checklist" -ForegroundColor Cyan

# 1. Check .env.local
if (Test-Path ".env.local") {
    Write-Host "✅ .env.local exists" -ForegroundColor Green
} else {
    Write-Host "❌ .env.local MISSING" -ForegroundColor Red
}

# 2. Check Docker/Supabase
if (Get-Command "docker" -ErrorAction SilentlyContinue) {
    $Running = docker ps | Select-String "supabase"
    if ($Running) {
        Write-Host "✅ Supabase Containers Running" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Supabase Containers NOT Running (Try 'npx supabase start')" -ForegroundColor Yellow
    }
}

# 3. Check Functions
$Push = Test-NetConnection -ComputerName localhost -Port 54321 -ErrorAction SilentlyContinue
if ($Push.TcpTestSucceeded) {
    Write-Host "✅ Supabase Gateway Open (Port 54321)" -ForegroundColor Green
} else {
    Write-Host "❌ Supabase Gateway Closed" -ForegroundColor Red
}

# 4. Run Verification
Write-Host "`n🏃 Running Verification Script..."
if (Test-Path "scripts/verify_phase4.js") {
    node scripts/verify_phase4.js
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Verification PASSED" -ForegroundColor Green
    } else {
        Write-Host "❌ Verification FAILED" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Verify Script Missing" -ForegroundColor Red
}
