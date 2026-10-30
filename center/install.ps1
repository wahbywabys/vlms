# VTC_LMS centre server installer for Windows 10/11. Run "Install VTC_LMS.cmd".
# Safe to run again: it keeps your .env and data, and updates and restarts the server.
param([switch]$Demo)
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Say($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Die($m) { Write-Host "`nERROR: $m" -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }

# Admin rights are needed once, to open ports 80/443 in Windows Firewall.
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"") + $(if ($Demo) { '-Demo' } else { @() })
  Start-Process powershell -Verb RunAs -ArgumentList $argList
  exit
}

# 1. Docker Desktop
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Start-Process 'https://www.docker.com/products/docker-desktop/'
  Die 'Docker Desktop is not installed. Install it (the page just opened), restart Windows, open Docker Desktop once, then run this installer again.'
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Say 'Starting Docker Desktop (this can take a minute)'
  $dd = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (Test-Path $dd) { Start-Process $dd }
  for ($i = 0; $i -lt 60; $i++) { Start-Sleep 3; docker info *> $null; if ($LASTEXITCODE -eq 0) { break } }
  if ($LASTEXITCODE -ne 0) { Die 'Docker Desktop is not running. Open it from the Start menu, wait for "Engine running", then run this again.' }
}

# 2. This computer's address on the centre network
$ip = (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|Docker|VirtualBox|VMware' } |
       Select-Object -First 1).IPv4Address.IPAddress
if (-not $ip) { $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127|169\.254)\.' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|Docker' } | Select-Object -First 1).IPAddress }
if (-not $ip) { $ip = '127.0.0.1' }

function Rand($n) { $b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); (($b | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, $n) }
function SetEnv($k, $v) {
  $lines = Get-Content .env
  if ($lines -match "^$k=") { $lines = $lines -replace "^$k=.*", "$k=$v" } else { $lines += "$k=$v" }
  Set-Content -Path .env -Value $lines -Encoding ascii
}

if (-not (Test-Path .env)) {
  Say "Creating settings (.env) for this server at $ip"
  Copy-Item .env.example .env
  SetEnv 'DB_PASSWORD' (Rand 32); SetEnv 'SESSION_SECRET' (Rand 64); SetEnv 'JWT_SECRET' (Rand 64); SetEnv 'CENTER_IP' $ip
  if ($Demo) { SetEnv 'SEED_DEMO' 'true' }
} else {
  $old = ((Get-Content .env) -match '^CENTER_IP=') -replace '^CENTER_IP=', ''
  if ($old -ne $ip) { Say "This computer's address changed from $old to $ip; updating .env"; SetEnv 'CENTER_IP' $ip }
}
$port = ((Get-Content .env) -match '^HTTP_PORT=') -replace '^HTTP_PORT=', ''
if (-not $port) { $port = '80' }
SetEnv 'HTTP_PORT_SUFFIX' $(if ($port -ne '80') { ":$port" } else { '' })

# 3. Firewall: let devices on the centre network reach ports 80 and 443
if (-not (Get-NetFirewallRule -DisplayName 'VTC_LMS server' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName 'VTC_LMS server' -Direction Inbound -Protocol TCP -LocalPort @($port, '443') -Action Allow -Profile Private,Domain | Out-Null
}
$net = Get-NetConnectionProfile | Where-Object { $_.IPv4Connectivity -ne 'Disconnected' } | Select-Object -First 1
if ($net -and $net.NetworkCategory -eq 'Public') {
  Say 'Setting the centre network to Private so devices can connect'
  Set-NetConnectionProfile -InterfaceIndex $net.InterfaceIndex -NetworkCategory Private
}

# 4. Images: from the offline bundle, the registry, or built from this checkout
$compose = @('compose')
$bundle = Get-ChildItem -Path images -Filter '*.tar*' -ErrorAction SilentlyContinue
if ($bundle) {
  Say 'Loading images from the offline bundle (no internet needed)'
  foreach ($f in $bundle) { docker load -i $f.FullName; if ($LASTEXITCODE -ne 0) { Die "Could not load $($f.Name)" } }
} else {
  docker compose pull 2>$null
  if ($LASTEXITCODE -ne 0) {
    $missing = @(docker compose config --images | Where-Object { docker image inspect $_ *> $null; $LASTEXITCODE -ne 0 })
    if ($missing.Count -eq 0) {
      Say 'No internet: using the images already on this computer'
    } elseif (Test-Path ..\api\Dockerfile) {
      Say 'Building the images from the source code (first time: about 5-10 minutes, needs internet)'
      $compose = @('compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.build.yml')
      docker @compose build
      if ($LASTEXITCODE -ne 0) { Die 'The build failed. See the messages above.' }
    } else { Die 'Could not download the images. Connect to the internet once, or use the offline bundle.' }
  }
}

# 5. Start
Say 'Starting VTC_LMS'
docker @compose up -d --remove-orphans
if ($LASTEXITCODE -ne 0) { Die 'Docker could not start the server. See the messages above.' }
$ok = $false
for ($i = 0; $i -lt 90; $i++) {
  try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "http://localhost:$port/join" | Out-Null; $ok = $true; break } catch { Start-Sleep 2 }
}
if (-not $ok) { Die 'The server did not answer. In this folder run: docker compose logs --tail 50' }

# Desktop shortcuts: Start (address + QR window) and Stop
$desk = [Environment]::GetFolderPath('Desktop')
$sh = New-Object -ComObject WScript.Shell
foreach ($n in @('Start VTC_LMS', 'Stop VTC_LMS')) {
  $l = $sh.CreateShortcut((Join-Path $desk "$n.lnk"))
  $l.TargetPath = Join-Path $PSScriptRoot "$n.cmd"; $l.WorkingDirectory = $PSScriptRoot
  $l.IconLocation = "$env:SystemRoot\System32\shell32.dll," + $(if ($n -like 'Start*') { '137' } else { '131' })
  $l.Save()
}

$addr = "http://$ip" + $(if ($port -ne '80') { ":$port" } else { '' })
Say 'VTC_LMS is running.'
Write-Host "`n  On every phone, tablet and laptop (connected to the centre Wi-Fi), open:`n`n      $addr`n" -ForegroundColor Green
Write-Host "  Join poster with QR code: $addr/join"
Write-Host '  Next time, double-click "Start VTC_LMS" on the desktop: it shows the address and QR code.'
& (Join-Path $PSScriptRoot 'start.ps1')
