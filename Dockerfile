# ===== STAGE 1: Dependency Installation =====
FROM node:18 AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# ===== STAGE 2: Runtime =====
FROM node:18-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app /app

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
