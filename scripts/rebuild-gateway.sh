#!/bin/bash
set -e

echo "=========================================="
echo "🧹 Cleaning dist and rebuilding Gateway..."
echo "=========================================="

# 1. Clean dist directory
rm -rf dist

# 2. Rebuild gateway container without cache
docker compose build --no-cache gateway

# 3. Force recreate gateway container
docker compose up -d --force-recreate gateway

echo "=========================================="
echo "✅ Gateway successfully rebuilt & running!"
echo "=========================================="
