# PowerShell script to build and push Docker image for Spelling Practice App

# Set variables
$IMAGE_NAME = "ghcr.io/nmemmert/spelling"
$VERSION = (Get-Content -Path "version.json" | ConvertFrom-Json).version

Write-Host "🔨 Building Docker image ${IMAGE_NAME}:${VERSION}..." -ForegroundColor Cyan

# Build the image
docker build -t ${IMAGE_NAME}:${VERSION} -t ${IMAGE_NAME}:latest .

Write-Host "✅ Build completed." -ForegroundColor Green
Write-Host "🧪 Testing the image..." -ForegroundColor Cyan

# Run container for testing
docker run --name spelling-test -d -p 3001:3000 ${IMAGE_NAME}:${VERSION}

# Wait for container to start
Start-Sleep -Seconds 5

# Test health endpoint
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Health check passed!" -ForegroundColor Green
    } else {
        Write-Host "❌ Health check failed with status $($response.StatusCode)" -ForegroundColor Red
        docker logs spelling-test
        docker stop spelling-test
        docker rm spelling-test
        exit 1
    }
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
    docker logs spelling-test
    docker stop spelling-test
    docker rm spelling-test
    exit 1
}

# Stop and remove test container
docker stop spelling-test
docker rm spelling-test

Write-Host "📤 Pushing image to GitHub Container Registry..." -ForegroundColor Cyan
docker push ${IMAGE_NAME}:${VERSION}
docker push ${IMAGE_NAME}:latest

Write-Host "🚀 Successfully built and pushed ${IMAGE_NAME}:${VERSION}" -ForegroundColor Green
Write-Host "Press any key to exit..."
$null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
