# ─────────────────────────────────────────
# Stage 1: Build the frontend + bundle server
# ─────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --strict-ssl=false

# Copy source files
COPY . .

# Build Vite frontend + esbuild server bundle
RUN npm run build

# ─────────────────────────────────────────
# Stage 2: Lean production image
# ─────────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

# Install curl for yt-dlp download + ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Download yt-dlp Linux binary and bake it into the image
# This means zero runtime download delay — yt-dlp is always ready
RUN mkdir -p /app/bin && \
    curl -L --retry 5 --retry-delay 3 \
      -o /app/bin/yt-dlp \
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux" && \
    chmod +x /app/bin/yt-dlp

# Copy built output from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm install --omit=dev --strict-ssl=false

# Copy environment example (actual secrets come from Railway/Render env vars)
COPY .env.example .env.example

# Expose the port (Railway/Render inject PORT env var automatically)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/ || exit 1

# Start the production server
ENV NODE_ENV=production
CMD ["node", "dist/server.cjs"]
