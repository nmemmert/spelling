# ===== STAGE 1: Dependency Installation =====
FROM node:20-slim AS deps

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# ===== STAGE 2: Runtime =====
FROM node:20-slim

# Install tini for proper signal handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    wget \
 && rm -rf /var/lib/apt/lists/*

# Create non-root user for better security
RUN groupadd -r spelling && useradd -r -g spelling spelling

# Setup application directory
WORKDIR /app

# Copy node modules and package files
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/package*.json /app/

# Copy application code
COPY . .

# Create and set permissions for data directory
RUN mkdir -p /app/data && chown -R spelling:spelling /app/data

# Switch to non-root user
USER spelling

# Set version label
LABEL version="1.1.0" \
      description="Spelling Practice Application" \
      maintainer="nmemmert" \
      org.opencontainers.image.source="https://github.com/nmemmert/spelling"

# Expose application port
EXPOSE 3000

# Use tini as init process and start application
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
