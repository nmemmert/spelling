#!/bin/bash
# Build and push Docker image for Spelling Practice App

# Set variables
IMAGE_NAME="ghcr.io/nmemmert/spelling"
VERSION=$(grep -o '"version": "[^"]*"' version.json | cut -d'"' -f4)

echo "🔨 Building Docker image ${IMAGE_NAME}:${VERSION}..."

# Build the image
docker build -t ${IMAGE_NAME}:${VERSION} -t ${IMAGE_NAME}:latest .

echo "✅ Build completed."
echo "🧪 Testing the image..."

# Run container for testing
docker run --name spelling-test -d -p 3001:3000 ${IMAGE_NAME}:${VERSION}

# Wait for container to start
sleep 5

# Test health endpoint
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)

if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed with status $HEALTH_STATUS"
    docker logs spelling-test
    docker stop spelling-test
    docker rm spelling-test
    exit 1
fi

# Stop and remove test container
docker stop spelling-test
docker rm spelling-test

echo "📤 Pushing image to GitHub Container Registry..."
docker push ${IMAGE_NAME}:${VERSION}
docker push ${IMAGE_NAME}:latest

echo "🚀 Successfully built and pushed ${IMAGE_NAME}:${VERSION}"
