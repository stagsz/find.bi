# HazOp API - Production Dockerfile
# Multi-stage build for optimized image size

# Stage 1: Build
FROM node:25-alpine AS builder

WORKDIR /app

# Copy workspace package files for dependency installation
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/

# Install dependencies
RUN npm ci --workspace=@hazop/api --workspace=@hazop/types --workspace=@hazop/utils

# Copy source code
COPY apps/api ./apps/api
COPY packages/types ./packages/types
COPY packages/utils ./packages/utils
COPY tsconfig.base.json ./

# Build shared packages first
WORKDIR /app/packages/types
RUN npm run build

WORKDIR /app/packages/utils
RUN npm run build

# Build API
WORKDIR /app/apps/api
RUN npm run build

# Stage 2: Production runtime
FROM node:25-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S hazop && \
    adduser -S -u 1001 -G hazop hazop

WORKDIR /app

# Copy production dependencies
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/

# Install production dependencies only
RUN npm ci --workspace=@hazop/api --workspace=@hazop/types --workspace=@hazop/utils --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/utils/dist ./packages/utils/dist

# Set ownership
RUN chown -R hazop:hazop /app

# Switch to non-root user
USER hazop

# Expose API port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:4000/health || exit 1

# Set environment
ENV NODE_ENV=production

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "apps/api/dist/main.js"]
