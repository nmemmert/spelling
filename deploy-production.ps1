# Production Deployment Script for Spelling Practice Application (PowerShell)
# Usage: .\deploy-production.ps1 [version]

param(
    [string]$Version = "3.0.0"
)

# Configuration
$APP_NAME = "spelling-practice"
$REGISTRY = "docker.io"  # Change to your registry
$IMAGE_NAME = "$REGISTRY/$APP_NAME"
$CONTAINER_NAME = "$APP_NAME-prod"
$ENV_FILE = ".env.production"

Write-Host "🚀 Starting production deployment for $APP_NAME v$Version" -ForegroundColor Green
Write-Host "=================================================="

# Check if Docker is running
try {
    docker info | Out-Null
}
catch {
    Write-Host "❌ Docker is not running. Please start Docker and try again." -ForegroundColor Red
    exit 1
}

# Create production environment file if it doesn't exist
if (-not (Test-Path $ENV_FILE)) {
    Write-Host "📄 Creating production environment file..." -ForegroundColor Yellow
    Copy-Item ".env.example" $ENV_FILE
    
    # Generate secure random secrets (PowerShell method)
    $JWT_SECRET = [System.Web.Security.Membership]::GeneratePassword(64, 0)
    $SESSION_SECRET = [System.Web.Security.Membership]::GeneratePassword(64, 0)
    
    # Update the production env file
    (Get-Content $ENV_FILE) -replace "your-super-secret-jwt-key-change-this-in-production", $JWT_SECRET | Set-Content $ENV_FILE
    (Get-Content $ENV_FILE) -replace "your-session-secret-change-this-too", $SESSION_SECRET | Set-Content $ENV_FILE
    
    Write-Host "⚠️  Production environment file created at $ENV_FILE" -ForegroundColor Yellow
    Write-Host "🔒 Please review and update the configuration before deployment!" -ForegroundColor Yellow
    Write-Host "🔑 Secure secrets have been auto-generated" -ForegroundColor Green
}

# Build the Docker image
Write-Host "🔨 Building Docker image..." -ForegroundColor Blue
docker build -t "${IMAGE_NAME}:${Version}" -t "${IMAGE_NAME}:latest" .

# Stop existing container if running
$existingContainer = docker ps -a --filter "name=$CONTAINER_NAME" --format "{{.Names}}" | Select-String "^$CONTAINER_NAME$"
if ($existingContainer) {
    Write-Host "🛑 Stopping existing container..." -ForegroundColor Yellow
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
}

# Create necessary directories
Write-Host "📁 Creating directories..." -ForegroundColor Blue
New-Item -ItemType Directory -Force -Path "data"
New-Item -ItemType Directory -Force -Path "logs"
New-Item -ItemType Directory -Force -Path "backups"

# Get absolute paths for volume mounts
$currentDir = (Get-Location).Path
$dataPath = Join-Path $currentDir "data"
$logsPath = Join-Path $currentDir "logs"
$backupsPath = Join-Path $currentDir "backups"

# Run the new container
Write-Host "🚀 Starting production container..." -ForegroundColor Green
docker run -d `
    --name $CONTAINER_NAME `
    --env-file $ENV_FILE `
    -p 3000:3000 `
    -v "${dataPath}:/app/data" `
    -v "${logsPath}:/app/logs" `
    -v "${backupsPath}:/app/backups" `
    --restart unless-stopped `
    --memory="512m" `
    --cpus="1.0" `
    "${IMAGE_NAME}:${Version}"

# Wait for container to start
Write-Host "⏳ Waiting for application to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Check health
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Application is healthy!" -ForegroundColor Green
        Write-Host "🌐 Access your application at: http://localhost:3000" -ForegroundColor Cyan
        Write-Host "📊 Health check: http://localhost:3000/health" -ForegroundColor Cyan
    }
}
catch {
    Write-Host "❌ Health check failed. Check logs:" -ForegroundColor Red
    docker logs $CONTAINER_NAME --tail 20
    exit 1
}

# Show container info
$containerStatus = docker inspect --format='{{.State.Status}}' $CONTAINER_NAME

Write-Host ""
Write-Host "📋 Deployment Summary:" -ForegroundColor Green
Write-Host "======================"
Write-Host "Container Name: $CONTAINER_NAME"
Write-Host "Image: ${IMAGE_NAME}:${Version}"
Write-Host "Status: $containerStatus"
Write-Host "Ports: 3000:3000"
Write-Host ""
Write-Host "🔧 Useful Commands:" -ForegroundColor Cyan
Write-Host "  View logs: docker logs $CONTAINER_NAME -f"
Write-Host "  Stop: docker stop $CONTAINER_NAME"
Write-Host "  Restart: docker restart $CONTAINER_NAME"
Write-Host "  Shell: docker exec -it $CONTAINER_NAME /bin/sh"
Write-Host ""
Write-Host "✅ Production deployment completed successfully!" -ForegroundColor Green