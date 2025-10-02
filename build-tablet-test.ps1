# PowerShell script to build and push Docker image with "test" tag for tablet testing

# Set variables
$IMAGE_NAME = "ghcr.io/nmemmert/spelling"
$TEST_TAG = "test"
$VERSION = (Get-Content -Path "version.json" | ConvertFrom-Json).version

Write-Host "🖊️ Building Docker image for TABLET HANDWRITING TESTING..." -ForegroundColor Magenta
Write-Host "📦 Image: ${IMAGE_NAME}:${TEST_TAG}" -ForegroundColor Cyan
Write-Host "🔖 Base Version: ${VERSION}" -ForegroundColor Cyan

# Add test-specific metadata to the build
$BUILD_DATE = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
$GIT_COMMIT = git rev-parse --short HEAD 2>$null
if (-not $GIT_COMMIT) { $GIT_COMMIT = "unknown" }

Write-Host "📝 Git Commit: $GIT_COMMIT" -ForegroundColor Yellow
Write-Host "📅 Build Date: $BUILD_DATE" -ForegroundColor Yellow

# Build the image with test tag and labels
Write-Host "🔨 Building Docker image..." -ForegroundColor Cyan
docker build `
    --label "version=${VERSION}-test" `
    --label "build-date=${BUILD_DATE}" `
    --label "git-commit=${GIT_COMMIT}" `
    --label "tablet-features=enabled" `
    --label "handwriting-recognition=native+enhanced" `
    -t ${IMAGE_NAME}:${TEST_TAG} `
    -t ${IMAGE_NAME}:${VERSION}-test `
    .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed." -ForegroundColor Green
Write-Host "🧪 Testing the image..." -ForegroundColor Cyan

# Run container for testing
docker run --name spelling-test-tablet -d -p 3002:3000 ${IMAGE_NAME}:${TEST_TAG}

# Wait for container to start
Write-Host "⏱️ Waiting for container to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Test health endpoint
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3002/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Health check passed!" -ForegroundColor Green
        
        # Test main page
        $mainResponse = Invoke-WebRequest -Uri "http://localhost:3002/" -UseBasicParsing -TimeoutSec 10
        if ($mainResponse.StatusCode -eq 200) {
            Write-Host "✅ Main page accessible!" -ForegroundColor Green
            
            # Check for handwriting features in the HTML
            if ($mainResponse.Content -like "*native-handwriting.js*") {
                Write-Host "🖊️ Native handwriting support detected!" -ForegroundColor Green
            }
            if ($mainResponse.Content -like "*handwriting-canvas*") {
                Write-Host "🎨 Handwriting canvas found!" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "❌ Health check failed with status $($response.StatusCode)" -ForegroundColor Red
        docker logs spelling-test-tablet
        docker stop spelling-test-tablet
        docker rm spelling-test-tablet
        exit 1
    }
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
    Write-Host "📋 Container logs:" -ForegroundColor Yellow
    docker logs spelling-test-tablet
    docker stop spelling-test-tablet
    docker rm spelling-test-tablet
    exit 1
}

# Stop and remove test container
docker stop spelling-test-tablet
docker rm spelling-test-tablet

Write-Host "📤 Pushing image to GitHub Container Registry..." -ForegroundColor Cyan
Write-Host "🏷️ Pushing tags: ${TEST_TAG} and ${VERSION}-test" -ForegroundColor Yellow

docker push ${IMAGE_NAME}:${TEST_TAG}
docker push ${IMAGE_NAME}:${VERSION}-test

if ($LASTEXITCODE -eq 0) {
    Write-Host "" -ForegroundColor Green
    Write-Host "🚀 Successfully built and pushed TABLET TEST image!" -ForegroundColor Green
    Write-Host "" -ForegroundColor White
    Write-Host "📱 TABLET TESTING INSTRUCTIONS:" -ForegroundColor Magenta
    Write-Host "=================================" -ForegroundColor Magenta
    Write-Host "1. Deploy using: docker pull ${IMAGE_NAME}:${TEST_TAG}" -ForegroundColor White
    Write-Host "2. Run on tablet-accessible server" -ForegroundColor White
    Write-Host "3. Test handwriting recognition with stylus/touch" -ForegroundColor White
    Write-Host "4. Features included:" -ForegroundColor White
    Write-Host "   • Native tablet handwriting APIs" -ForegroundColor Cyan
    Write-Host "   • Pressure-sensitive stylus support" -ForegroundColor Cyan
    Write-Host "   • Enhanced pattern recognition" -ForegroundColor Cyan
    Write-Host "   • Touch event optimization" -ForegroundColor Cyan
    Write-Host "   • Pointer Events API integration" -ForegroundColor Cyan
    Write-Host "" -ForegroundColor White
    Write-Host "🔗 Image: ${IMAGE_NAME}:${TEST_TAG}" -ForegroundColor Yellow
    Write-Host "" -ForegroundColor White
} else {
    Write-Host "❌ Push failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")