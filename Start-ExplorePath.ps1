$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "ExplorePath 真實感測版（Expo Go）" -ForegroundColor Green
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

Write-Host "Node：$(node --version)"
Write-Host "npm：$(npm --version)"

if (-not (Test-Path ".\node_modules\.bin\expo.cmd")) {
    Write-Host "第一次啟動，正在安裝免費的 Expo 專案套件……" -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "套件安裝失敗。請確認 Windows 可以連上網路後再試。" -ForegroundColor Red
        Read-Host "按 Enter 結束"
        exit $LASTEXITCODE
    }
}

Write-Host ""
Write-Host "即將顯示 QR Code。請用 iPhone 相機掃描，再選擇用 Expo Go 開啟。" -ForegroundColor Cyan
Write-Host "真實探索請允許『使用 App 期間』定位；步數權限可自行選擇。" -ForegroundColor Cyan
Write-Host "關閉此視窗就會停止 App 連線。"
Write-Host ""
npm start

if ($LASTEXITCODE -ne 0) {
    Write-Host "Expo 未正常啟動。請把這個視窗最後 20 行截圖給我。" -ForegroundColor Red
    Read-Host "按 Enter 結束"
}
