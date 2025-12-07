# Serve all Supabase Edge Functions locally
# Usage: ./scripts/serve_functions.ps1

$ErrorActionPreference = "Stop"

$SupabaseCmd = "npx supabase"
if (Get-Command "supabase" -ErrorAction SilentlyContinue) {
    $SupabaseCmd = "supabase"
}

Write-Host "🚀 Serving ALL Edge Functions..." -ForegroundColor Cyan

# 中文注释：优先加载本地环境变量文件（例如 supabase/.env.local），以便 Edge Functions 读取 ENV=dev
$EnvFileLocal = Join-Path $PWD "supabase/.env.local"
$EnvFileDefault = Join-Path $PWD "supabase/.env"
$EnvArg = ""
if (Test-Path $EnvFileLocal) { $EnvArg = "--env-file `"$EnvFileLocal`"" }
elseif (Test-Path $EnvFileDefault) { $EnvArg = "--env-file `"$EnvFileDefault`"" }

Write-Host "   Command: $SupabaseCmd functions serve --no-verify-jwt $EnvArg"
Write-Host "   (This process will block. Press Ctrl+C to stop)" -ForegroundColor Gray

# Run directly in current shell to see output
Invoke-Expression "$SupabaseCmd functions serve --no-verify-jwt $EnvArg"
