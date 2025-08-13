# PowerShell script for Docker build and push with GitHub authentication
# This script will build and push your Docker image to GitHub Container Registry
# You must set the CR_PAT environment variable with your GitHub Personal Access Token

# Check if CR_PAT environment variable is set
if (-not $env:CR_PAT) {
    Write-Host "❌ Error: CR_PAT environment variable is not set." -ForegroundColor Red
    Write-Host "Please set your GitHub Personal Access Token as an environment variable:" -ForegroundColor Yellow
    Write-Host '$env:CR_PAT = "YOUR_GITHUB_PAT"' -ForegroundColor Yellow
    exit 1
}

# Set variables
$IMAGE_NAME = "ghcr.io/nmemmert/spelling"
$VERSION = (Get-Content -Path "version.json" | ConvertFrom-Json).version
$GITHUB_USERNAME = "nmemmert"

Write-Host "🔑 Logging in to GitHub Container Registry..." -ForegroundColor Cyan
# Login to GitHub Container Registry using environment variable
$env:CR_PAT | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Login failed. Please check your GitHub token." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Successfully logged in to GitHub Container Registry." -ForegroundColor Green
Write-Host "🔨 Building Docker image ${IMAGE_NAME}:${VERSION}..." -ForegroundColor Cyan

# Build the image
docker build -t ${IMAGE_NAME}:${VERSION} -t ${IMAGE_NAME}:latest .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed." -ForegroundColor Green
Write-Host "📤 Pushing image to GitHub Container Registry..." -ForegroundColor Cyan

# Push both tags to registry
docker push ${IMAGE_NAME}:${VERSION}
docker push ${IMAGE_NAME}:latest

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker push failed." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Successfully pushed ${IMAGE_NAME}:${VERSION} and ${IMAGE_NAME}:latest" -ForegroundColor Green
Write-Host "🎉 Done! Your Docker image is now available at ${IMAGE_NAME}:${VERSION}" -ForegroundColor Cyan
