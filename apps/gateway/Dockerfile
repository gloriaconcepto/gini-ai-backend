# Multi-stage Dockerfile for NestJS API Gateway in NPM Monorepo
# 

# Stage 1: Base image
FROM node:20-alpine AS base
WORKDIR /app

# Stage 2: Dependencies & Build
FROM base AS builder
# Copy workspace configuration & lockfiles
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build workspace packages and gateway
RUN npx nest build gateway

# Stage 3: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-http-header-size=65536"

# Security: Non-root user
USER node

# Copy compiled output and node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json

EXPOSE 3000

CMD ["node", "dist/apps/gateway/main.js"]
