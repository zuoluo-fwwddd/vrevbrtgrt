$ErrorActionPreference = 'Stop'
$statePath = Join-Path $PSScriptRoot '.local-website-processes.json'
if (-not (Test-Path -LiteralPath $statePath)) { Write-Host '没有找到本地网站进程记录。'; exit 0 }
$state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
foreach ($item in @(@{id=$state.apiPid;ticks=$state.apiStartTicks}, @{id=$state.frontendPid;ticks=$state.frontendStartTicks})) {
    $process = Get-Process -Id ([int]$item.id) -ErrorAction SilentlyContinue
    if ($process -and $process.ProcessName -eq 'node' -and $process.StartTime.Ticks -eq [long]$item.ticks) { Stop-Process -Id $process.Id -Force }
}
Remove-Item -LiteralPath $statePath -Force
Write-Host '本地网站服务已停止。'

