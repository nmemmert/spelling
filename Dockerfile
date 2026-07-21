FROM node:26-slim
WORKDIR /app

# Install piper TTS binary and an English voice model
RUN apt-get update && apt-get install -y --no-install-recommends wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN wget -qO /tmp/piper.tar.gz \
      https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz \
    && tar -xzf /tmp/piper.tar.gz -C /tmp \
    && mv /tmp/piper/piper /usr/local/bin/piper \
    && rm -rf /tmp/piper*

RUN mkdir -p /app/voices \
    && wget -qO /app/voices/en_US-lessac-medium.onnx \
       "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx" \
    && wget -qO /app/voices/en_US-lessac-medium.onnx.json \
       "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json"

COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q -O - http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
