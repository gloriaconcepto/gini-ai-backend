# Multi-stage Dockerfile for NestJS API Gateway in NPM Monorepo
# 

# Stage 1: Base image
FROM node:20-alpine AS base
WORKDIR /app

# Stage 2: Dependencies & Build
FROM base AS builder
# Copy workspace configuration & lockfiles
COPY package.json package-lock.json ./

# Install dependencies with network timeout resilience
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 300000 \
    && npm ci --no-audit

# Copy source code
COPY . .

# Build workspace packages and gateway
RUN npx nest build gateway

# Stage 3: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Security: Non-root user
USER node

# Copy compiled output and node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json

EXPOSE 3000

CMD ["node", "dist/apps/gateway/main.js"]
