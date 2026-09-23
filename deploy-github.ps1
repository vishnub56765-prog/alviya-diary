# ALVIYA DAIRY - One-Command GitHub Push & Deploy Script
param(
    [string]$RepoUrl
)

$git = "C:\Users\DELL\.gemini\antigravity\scratch\mingit\cmd\git.exe"
if (-not (Test-Path $git)) {
    $git = "git"
}

if (-not $RepoUrl) {
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host " ALVIYA DAIRY - Push to GitHub" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "1. Create a new repository on GitHub: https://github.com/new" -ForegroundColor Yellow
    Write-Host "   (Name it e.g. alviya-dairy, keep it Public or Private)" -ForegroundColor Yellow
    Write-Host "2. Copy the repository URL (e.g. https://github.com/yourname/alviya-dairy.git)" -ForegroundColor Yellow
    Write-Host ""
    $RepoUrl = Read-Host "Paste your GitHub Repository URL here"
}

if (-not $RepoUrl) {
    Write-Host "No repository URL provided. Aborting." -ForegroundColor Red
    exit 1
}

Write-Host "Setting remote origin to $RepoUrl..." -ForegroundColor Cyan
& $git remote remove origin 2>$null
& $git remote add origin $RepoUrl
& $git branch -M main

Write-Host "Pushing to GitHub..." -ForegroundColor Green
& $git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " SUCCESS! Code pushed to GitHub!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "To enable your live website link on GitHub Pages:" -ForegroundColor Cyan
    Write-Host "1. Open your repository on GitHub." -ForegroundColor White
    Write-Host "2. Go to Settings -> Pages." -ForegroundColor White
    Write-Host "3. Under 'Build and deployment' -> Source: select 'GitHub Actions'." -ForegroundColor White
    Write-Host "   Your website will automatically deploy and go live!" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Host "Push failed. Please ensure you are logged into GitHub in your browser or terminal." -ForegroundColor Red
}
