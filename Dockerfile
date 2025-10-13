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

# Create logs directory
RUN mkdir -p /app/logs && chown -R spelling:spelling /app/logs

# Set version and metadata labels
LABEL version="3.0.0" \
      description="Enhanced Spelling Practice Application - Production Ready" \
      maintainer="NateEmmert" \
      org.opencontainers.image.source="https://git.necloud.us/nmemmert/Spelling.git" \
      org.opencontainers.image.title="Spelling Practice" \
      org.opencontainers.image.description="Multi-user spelling practice with gamification and analytics"

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Expose application port
EXPOSE 3000

# Use tini as init process and start application
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
