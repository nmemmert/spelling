# PowerShell script to commit, tag, and push changes to GitHub
# Run this script to perform all necessary Git operations

# Ensure we're in the right directory
$ScriptDir = Split-Path $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "🔍 Checking Git status..." -ForegroundColor Cyan
git status

Write-Host "📦 Adding all changes..." -ForegroundColor Cyan
git add .

Write-Host "💾 Committing changes..." -ForegroundColor Cyan
git commit -m "Fix v1.1.0: Analytics, Sessions, and Error Handling Improvements"

Write-Host "🏷️ Creating tag v1.1.0..." -ForegroundColor Cyan
git tag -a v1.1.0 -m "Version 1.1.0 - Fixed analytics and sessions display, added error handling"

Write-Host "🚀 Pushing changes to GitHub..." -ForegroundColor Cyan
git push origin main

Write-Host "📤 Pushing tags to GitHub..." -ForegroundColor Cyan
git push origin v1.1.0

Write-Host "✅ Done! Changes have been pushed to GitHub repository." -ForegroundColor Green

Write-Host "Press any key to exit..."
$null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
