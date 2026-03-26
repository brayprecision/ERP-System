<#
.SYNOPSIS
  Rebuild and run BPERP during beta testing (Windows).

.DESCRIPTION
  Default: runs an unpacked packaged build (electron-builder --win --dir) — faster than the full NSIS
  installer but uses the same layout as an installed app (asar + resources/backend + resources/frontend).

  -Dev skips packaging: runs Electron from the repo (NODE_ENV=development). Use this for rapid UI/backend
  edits; use the default when you need to verify native modules and packaged paths.

.PARAMETER Dev
  Run from source with npm start (development). No electron-builder step.

.PARAMETER FullInstaller
  Run npm run build:win (NSIS + unpacked). Slowest; use when you need the real .exe installer output.

.PARAMETER SkipNativeRebuild
  Skip npm run rebuild:backend (faster when only JS/HTML/CSS changed and native addons already match Electron).

.PARAMETER SkipBackendInstall
  Skip npm run backend:install (faster when backend dependencies did not change).

.EXAMPLE
  .\scripts\launch-beta.ps1

.EXAMPLE
  .\scripts\launch-beta.ps1 -Dev

.EXAMPLE
  .\scripts\launch-beta.ps1 -SkipBackendInstall -SkipNativeRebuild
#>
param(
    [switch]$Dev,
    [switch]$FullInstaller,
    [switch]$SkipNativeRebuild,
    [switch]$SkipBackendInstall
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Invoke-Npm {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & npm @Args
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

if ($Dev) {
    if (-not $SkipNativeRebuild) {
        Invoke-Npm run rebuild:backend
    }
    $env:NODE_ENV = "development"
    Invoke-Npm start
    exit 0
}

if (-not $SkipBackendInstall) {
    Invoke-Npm run backend:install
}
if (-not $SkipNativeRebuild) {
    Invoke-Npm run rebuild:backend
}

if ($FullInstaller) {
    Invoke-Npm run build:win
}
else {
    Invoke-Npm run pack:win
}

$exe = Join-Path $Root "dist-installers\win-unpacked\BPERP.exe"
if (-not (Test-Path -LiteralPath $exe)) {
    Write-Error "Expected executable not found: $exe (check electron-builder output above)."
    exit 1
}

Write-Host "Starting: $exe"
Start-Process -FilePath $exe
