#!/bin/bash

# Production Deployment Script for Spelling Practice Application
# Usage: ./deploy-production.sh [version]

set -e  # Exit on any error

# Configuration
APP_NAME="spelling-practice"
VERSION=${1:-"3.0.0"}
REGISTRY="docker.io"  # Change to your registry
IMAGE_NAME="${REGISTRY}/${APP_NAME}"
CONTAINER_NAME="${APP_NAME}-prod"
ENV_FILE=".env.production"

echo "🚀 Starting production deployment for ${APP_NAME} v${VERSION}"
echo "=================================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Create production environment file if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
    echo "📄 Creating production environment file..."
    cp .env.example "$ENV_FILE"
    
    # Generate secure random secrets
    JWT_SECRET=$(openssl rand -hex 32)
    SESSION_SECRET=$(openssl rand -hex 32)
    
    # Update the production env file
    sed -i "s/NODE_ENV=production/NODE_ENV=production/" "$ENV_FILE"
    sed -i "s/your-super-secret-jwt-key-change-this-in-production/${JWT_SECRET}/" "$ENV_FILE"
    sed -i "s/your-session-secret-change-this-too/${SESSION_SECRET}/" "$ENV_FILE"
    
    echo "⚠️  Production environment file created at $ENV_FILE"
    echo "🔒 Please review and update the configuration before deployment!"
    echo "🔑 Secure secrets have been auto-generated"
fi

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -t "${IMAGE_NAME}:${VERSION}" -t "${IMAGE_NAME}:latest" .

# Stop existing container if running
if docker ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo "🛑 Stopping existing container..."
    docker stop "$CONTAINER_NAME" || true
    docker rm "$CONTAINER_NAME" || true
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p ./data
mkdir -p ./logs
mkdir -p ./backups

# Run the new container
echo "🚀 Starting production container..."
docker run -d \
    --name "$CONTAINER_NAME" \
    --env-file "$ENV_FILE" \
    -p 3000:3000 \
    -v "$(pwd)/data:/app/data" \
    -v "$(pwd)/logs:/app/logs" \
    -v "$(pwd)/backups:/app/backups" \
    --restart unless-stopped \
    --memory="512m" \
    --cpus="1.0" \
    "${IMAGE_NAME}:${VERSION}"

# Wait for container to be healthy
echo "⏳ Waiting for application to start..."
sleep 5

# Check health
if docker exec "$CONTAINER_NAME" wget --quiet --tries=1 --spider http://localhost:3000/health; then
    echo "✅ Application is healthy!"
    echo "🌐 Access your application at: http://localhost:3000"
    echo "📊 Health check: http://localhost:3000/health"
else
    echo "❌ Health check failed. Check logs:"
    docker logs "$CONTAINER_NAME" --tail 20
    exit 1
fi

# Show container info
echo ""
echo "📋 Deployment Summary:"
echo "======================"
echo "Container Name: $CONTAINER_NAME"
echo "Image: ${IMAGE_NAME}:${VERSION}"
echo "Status: $(docker inspect --format='{{.State.Status}}' $CONTAINER_NAME)"
echo "Ports: 3000:3000"
echo ""
echo "🔧 Useful Commands:"
echo "  View logs: docker logs $CONTAINER_NAME -f"
echo "  Stop: docker stop $CONTAINER_NAME"
echo "  Restart: docker restart $CONTAINER_NAME"
echo "  Shell: docker exec -it $CONTAINER_NAME /bin/sh"
echo ""
echo "✅ Production deployment completed successfully!"