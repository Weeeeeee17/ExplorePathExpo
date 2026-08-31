param([switch]$Candidate)

$ErrorActionPreference = 'Stop'
$projectPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$workspacePath = Split-Path $projectPath -Parent
$manifest = Get-Content -LiteralPath (Join-Path $projectPath 'package.json') -Raw | ConvertFrom-Json
if ($manifest.version -ne '0.9.1' -or $manifest.dependencies.expo -ne '~54.0.0') { throw 'Expected v0.9.1 / SDK 54 before packaging' }
$zipPath = Join-Path $workspacePath 'ExplorePath_v0.9.1_ExpoGo.zip'
if ($Candidate) {
    $candidateDirectory = Join-Path $projectPath 'dist-v091-package-check'
    New-Item -ItemType Directory -Path $candidateDirectory -Force | Out-Null
    $zipPath = Join-Path $candidateDirectory 'candidate.zip'
}
if (Test-Path -LiteralPath $zipPath) { throw "ZIP already exists; preserve it and choose a new release filename: $zipPath" }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::CreateNew)
$archive = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    function Get-ReleaseFiles([string]$directory) {
        foreach ($entry in (Get-ChildItem -LiteralPath $directory -Force)) {
            if ($entry.PSIsContainer) {
                if ($entry.Name -notmatch '^(node_modules[^/]*|\.git|\.expo|dist.*)$') { Get-ReleaseFiles $entry.FullName }
            } elseif (($entry.Name -notlike '.env*' -or $entry.Name -eq '.env.example') -and $entry.Name -notlike '*.log' -and $entry.Name -ne '.npmrc') {
                $entry
            }
        }
    }
    $files = Get-ReleaseFiles $projectPath
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($projectPath.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, "ExplorePathExpo/$relative", [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
    $launcher = $archive.CreateEntry('Start-ExplorePath.bat')
    $writer = New-Object System.IO.StreamWriter($launcher.Open(), [System.Text.Encoding]::ASCII)
    try { $writer.Write("@echo off`r`nPowerShell -NoProfile -ExecutionPolicy Bypass -File `"%~dp0ExplorePathExpo\Start-ExplorePath.ps1`"`r`npause`r`n") } finally { $writer.Dispose() }
    $readme = $archive.CreateEntry('START_HERE.txt')
    $writer = New-Object System.IO.StreamWriter($readme.Open(), [System.Text.Encoding]::UTF8)
    try { $writer.Write("ExplorePath v0.9.1 / SDK 54：寵物故事與分頁順序更新測試版。`r`n先在舊版終端機按 Ctrl+C，停止舊版伺服器。`r`n完整解壓縮到新資料夾，再雙擊最外層 Start-ExplorePath.bat。`r`n不要直接在壓縮檔內開啟；不要覆蓋舊資料夾。`r`n等待安裝完成，手機與電腦連同一 Wi-Fi，掃描新視窗的 QR Code。`r`n完整說明：ExplorePathExpo/README_WINDOWS_IPHONE.md`r`n真正多人連線：ExplorePathExpo/SUPABASE_SETUP.md`r`nv0.9.1 為開發測試版，未接上 Supabase 時只有本機預覽。`r`n不需要刪除手機 Expo Go 或購買 Apple Developer 會員。") } finally { $writer.Dispose() }
} finally { $archive.Dispose(); $stream.Dispose() }
$verify = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $names = @($verify.Entries | ForEach-Object { $_.FullName })
    foreach ($required in @('Start-ExplorePath.bat','START_HERE.txt','ExplorePathExpo/package.json','ExplorePathExpo/package-lock.json','ExplorePathExpo/App.tsx','ExplorePathExpo/SUPABASE_SETUP.md','ExplorePathExpo/DevelopmentSupport/compatibility.test.ts','ExplorePathExpo/doc/v0.9.1-test-report.md','ExplorePathExpo/doc/pet-story-drafts.md','ExplorePathExpo/supabase/migrations/202608310003_pet_display_v09.sql')) {
        if ($names -notcontains $required) { throw "Missing entry: $required" }
    }
    if ($names -match '/(node_modules[^/]*|dist[^/]*|\.git|\.expo)/' -or $names -match '/\.env(?!\.example$)' -or $names -match '/\.npmrc$') { throw 'Forbidden dependency, cache or secret in ZIP' }
    $reader = New-Object System.IO.StreamReader($verify.GetEntry('ExplorePathExpo/package-lock.json').Open())
    try { $reader.ReadToEnd() | node (Join-Path $PSScriptRoot 'validate-project.mjs') --lock-stdin } finally { $reader.Dispose() }
    if ($LASTEXITCODE -ne 0) { throw 'ZIP lockfile is not v0.9.1 / SDK 54' }
    $petEntries = @($names | Where-Object { $_ -match '^ExplorePathExpo/assets/pets/[^/]+/(egg|juvenile)\.jpg$' })
    if ($petEntries.Count -ne 20) { throw 'Expected exactly 12 egg and 8 juvenile images' }
    Write-Host "Verified $($names.Count) ZIP entries."
} finally { $verify.Dispose() }
Get-Item -LiteralPath $zipPath | Select-Object FullName, Length
Get-FileHash -LiteralPath $zipPath -Algorithm SHA256
