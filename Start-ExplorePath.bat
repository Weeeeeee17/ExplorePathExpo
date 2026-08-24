@echo off
chcp 65001 >nul
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-ExplorePath.ps1"
pause
