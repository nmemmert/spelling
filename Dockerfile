# ========== STAGE 1: Build ==========
FROM node:18 AS builder

WORKDIR /app

# Copy only what's needed to install dependencies first (for better cache)
COPY package*.json ./

# Install dependencies without unnecessary cache
RUN npm ci --omit=dev

# Then copy the rest of the source
COPY . .

# Build the app (modify this command if you're not using a build script)
RUN npm run build


# ========== STAGE 2: Runtime ==========
FROM node:18-slim AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built app from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Set correct permissions if needed
RUN chown -R node:node /app

USER node

# Expose port (adjust if needed)
EXPOSE 3000

# Start the app
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
