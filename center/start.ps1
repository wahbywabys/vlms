# Start VTC_LMS on this computer and show its address and QR code in a small
# window. Double-click "Start VTC_LMS" on the desktop (made by the installer).
Set-Location -Path $PSScriptRoot
$Host.UI.RawUI.WindowTitle = 'VTC_LMS server'
function Die($m) { Write-Host "`n$m" -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }
if (-not (Test-Path .env)) { Die 'VTC_LMS is not installed yet. Double-click "Install VTC_LMS.cmd" first.' }

Write-Host 'Starting VTC_LMS...' -ForegroundColor Cyan
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  $dd = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (Test-Path $dd) { Start-Process $dd }
  for ($i = 0; $i -lt 60; $i++) { Start-Sleep 3; docker info *> $null; if ($LASTEXITCODE -eq 0) { break } }
  if ($LASTEXITCODE -ne 0) { Die 'Docker Desktop is not running. Open it from the Start menu, wait for "Engine running", then try again.' }
}

# The laptop may have joined another Wi-Fi since last time: show the address it has now.
$ip = (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|Docker|VirtualBox|VMware' } |
       Select-Object -First 1).IPv4Address.IPAddress
if (-not $ip) { $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127|169\.254)\.' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|Docker' } | Select-Object -First 1).IPAddress }
if (-not $ip) { $ip = '127.0.0.1' }
$lines = Get-Content .env
$old = ($lines -match '^CENTER_IP=') -replace '^CENTER_IP=', ''
if ($old -ne $ip) {
  $lines = $lines -replace '^CENTER_IP=.*', "CENTER_IP=$ip"
  Set-Content -Path .env -Value $lines -Encoding ascii
}
$port = (($lines -match '^HTTP_PORT=') -replace '^HTTP_PORT=', '')
if (-not $port) { $port = '80' }

docker compose up -d
if ($LASTEXITCODE -ne 0) { Die 'Docker could not start VTC_LMS. Run "Install VTC_LMS.cmd" again.' }
$ok = $false
for ($i = 0; $i -lt 90; $i++) {
  try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "http://localhost:$port/join" | Out-Null; $ok = $true; break } catch { Start-Sleep 2 }
}
if (-not $ok) { Die 'VTC_LMS did not answer. In this folder run: docker compose logs --tail 50' }

$addr = "http://$ip" + $(if ($port -ne '80') { ":$port" } else { '' })
Write-Host "`n  VTC_LMS is running at  $addr`n" -ForegroundColor Green
Write-Host '  Phones and tablets: join the same Wi-Fi and scan the QR code in the window.'

# A small app-style window with the address and QR code (Edge ships with Windows 10/11).
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($edge) { Start-Process $edge -ArgumentList "--app=http://localhost:$port/join?window=1", '--window-size=520,860', "--user-data-dir=$env:LOCALAPPDATA\VTC_LMS\window" }
else { Start-Process "http://localhost:$port/join" }
Start-Sleep 4
