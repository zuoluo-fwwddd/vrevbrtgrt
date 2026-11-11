$ErrorActionPreference = 'Stop'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw '未找到 Node.js。请先安装支持 node:sqlite 的 Node.js 版本。' }
$frontendPort = 5173
$apiPort = 3000
$frontendListener = Get-NetTCPConnection -LocalPort $frontendPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($frontendListener) { throw "端口 $frontendPort 已被占用。请先停止已运行的本地网站。" }
$apiListener = Get-NetTCPConnection -LocalPort $apiPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($apiListener) { throw "端口 $apiPort 已被占用。请先停止已运行的 API 服务。" }
$adminAccount = Read-Host '管理员账号（仅首次启动用于初始化；已有管理员时不会修改）'
$passwordSecure = Read-Host '管理员密码（仅首次启动用于初始化，至少 12 位）' -AsSecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($passwordSecure)
try { $adminPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr) }
if ($adminAccount.Trim().Length -lt 3 -or $adminPassword.Length -lt 12) { throw '管理员账号至少 3 位，密码至少 12 位。' }
$telegramSecure = Read-Host 'Telegram Bot Token（没有可直接回车）' -AsSecureString
$telegramPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($telegramSecure)
try { $telegramToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($telegramPtr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($telegramPtr) }
$telegramChatId = ''
if ($telegramToken) { $telegramChatId = Read-Host '私有群 Chat ID（公开群可留空）' }
$env:FRONTEND_HOST = '127.0.0.1'; $env:FRONTEND_PORT = "$frontendPort"
$frontProc = Start-Process -FilePath $node.Source -ArgumentList 'frontend-server.mjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
$env:HOST = '127.0.0.1'; $env:PORT = "$apiPort"; $env:DB_PATH = Join-Path $PSScriptRoot 'store.db'
$env:FRONTEND_ORIGINS = "http://localhost:$frontendPort,http://127.0.0.1:$frontendPort"
$env:ADMIN_ACCOUNT = $adminAccount.Trim(); $env:ADMIN_PASSWORD = $adminPassword
$env:TELEGRAM_BOT_TOKEN = $telegramToken; $env:TELEGRAM_CHAT_ID = $telegramChatId
$apiProc = Start-Process -FilePath $node.Source -ArgumentList 'server.mjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
$env:ADMIN_ACCOUNT = ''; $env:ADMIN_PASSWORD = ''; $env:TELEGRAM_BOT_TOKEN = ''; $env:TELEGRAM_CHAT_ID = ''
$state = @{ frontendPid = $frontProc.Id; frontendStartTicks = (Get-Process -Id $frontProc.Id).StartTime.Ticks; apiPid = $apiProc.Id; apiStartTicks = (Get-Process -Id $apiProc.Id).StartTime.Ticks; createdAt = (Get-Date).ToString('o') }
$state | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot '.local-website-processes.json') -Encoding utf8
Start-Sleep -Seconds 2
if ($apiProc.HasExited -or $frontProc.HasExited) { throw '本地服务未能启动。请检查 Node.js 版本和端口占用。' }
Write-Host "商城： http://localhost:$frontendPort/"
Write-Host "后台： http://localhost:$frontendPort/admin"
Write-Host '停止服务：运行 .\停止本地网站.ps1'

