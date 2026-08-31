param([switch]$VerifyOnly)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "ExplorePath v0.9.1 寵物故事與分頁順序更新測試版（App Store Expo Go / SDK 54）" -ForegroundColor Green
Write-Host "目前資料夾：$PSScriptRoot"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "找不到 Node.js。請先安裝 Node.js LTS：https://nodejs.org/" -ForegroundColor Red
    Read-Host "按 Enter 結束"
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "找不到 npm。請重新安裝 Node.js LTS。" -ForegroundColor Red
    Read-Host "按 Enter 結束"
    exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'package.json'))) {
    Write-Host '請完整解壓縮 ZIP，並從 ExplorePathExpo 資料夾執行此啟動器。' -ForegroundColor Red
    exit 1
}

Write-Host "Node：$(node --version)"
Write-Host "npm：$(npm --version)"

$nodeVersion = [version](node -p 'process.versions.node')
if ($nodeVersion -lt [version]'22.13.0') {
    Write-Host '此專案需要 Node.js 22.13 以上；請安裝 Node 24 LTS 後重新開啟。' -ForegroundColor Red
    Read-Host '按 Enter 結束'
    exit 1
}

$manifest = Get-Content -LiteralPath '.\package.json' -Raw | ConvertFrom-Json
if ($manifest.version -ne '0.9.1' -or $manifest.dependencies.expo -ne '~54.0.0') {
    Write-Host '目前不是 v0.9.1 / SDK 54 專案。請完整解壓縮新版 ZIP 到新資料夾。' -ForegroundColor Red
    exit 1
}

$lockHash = (Get-FileHash -LiteralPath '.\package-lock.json' -Algorithm SHA256).Hash
$installStamp = '.\node_modules\.explorepath-lock.sha256'
$needsInstall = -not (Test-Path -LiteralPath '.\node_modules\.bin\expo.cmd')
try {
    $installedExpo = Get-Content -LiteralPath '.\node_modules\expo\package.json' -Raw | ConvertFrom-Json
    $needsInstall = $needsInstall -or $installedExpo.version -notlike '54.*' -or
        (Get-Content -LiteralPath $installStamp -Raw).Trim() -ne $lockHash
} catch { $needsInstall = $true }

if ($needsInstall) {
    Write-Host "正在依鎖定版本安裝 SDK 54 套件（首次啟動或版本已變更）……" -ForegroundColor Yellow
    npm.cmd ci --no-fund
    if ($LASTEXITCODE -ne 0) {
        Write-Host "套件安裝失敗。請確認 Windows 可以連上網路後再試。" -ForegroundColor Red
        Read-Host "按 Enter 結束"
        exit 1
    }
    Set-Content -LiteralPath $installStamp -Value $lockHash -Encoding ASCII
}

node DevelopmentSupport/validate-project.mjs
if ($LASTEXITCODE -ne 0) { exit 1 }
if ($VerifyOnly) {
    Write-Host 'SDK 54 安裝與啟動前檢查通過；VerifyOnly 不啟動伺服器。' -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host '請先在其他視窗按 Ctrl+C 停止舊版伺服器，避免掃到舊版 QR。' -ForegroundColor Yellow
Write-Host 'iPhone 使用 App Store 的 Expo Go（支援 SDK 54）；不需要付費簽署或重裝手機 App。' -ForegroundColor Cyan
Write-Host "即將顯示 QR Code。請用 iPhone 相機掃描，再選擇用 Expo Go 開啟。" -ForegroundColor Cyan
Write-Host "真實探索請允許『使用 App 期間』定位；步數權限可自行選擇。" -ForegroundColor Cyan
Write-Host "關閉此視窗就會停止 App 連線。"
Write-Host ""
npm.cmd start -- --go --clear

if ($LASTEXITCODE -ne 0) {
    Write-Host "Expo 未正常啟動。請把這個視窗最後 20 行截圖給我。" -ForegroundColor Red
    Read-Host "按 Enter 結束"
}
