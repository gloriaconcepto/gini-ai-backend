---
name: auto-rebuild-on-pull
description: 'Automatically cleans local build artifacts and rebuilds the NestJS Gateway Docker container without cache after any Git pull or merge operation. Trigger this workflow whenever new changes are pulled from remote branches (such as development or main) or when code changes need to be reflected in the running Docker gateway instance.'
---

# Auto Rebuild on Pull Workflow

When working with this repository, changes pulled from remote Git branches only update the host filesystem. Because the `gateway` container runs a compiled Docker image without live volume mounts, pulling code requires a fresh rebuild and recreation of the gateway container to prevent serving stale builds or outdated Swagger schemas.

## Automated Execution Procedure

Whenever a `git pull` or branch merge is performed, immediately execute the following sequence:

```bash
# 1. Remove stale local compilation artifacts
rm -rf dist

# 2. Build the Docker image from scratch without cache
docker compose build --no-cache gateway

# 3. Force recreate the gateway container with the new image
docker compose up -d --force-recreate gateway
```

Alternatively, run the dedicated helper script:

```bash
npm run docker:rebuild
# or
bash scripts/rebuild-gateway.sh
```

## Git Hook Automation

A Git `post-merge` hook is configured at `.git/hooks/post-merge`. When you run `git pull` in the terminal, Git will automatically execute `scripts/rebuild-gateway.sh` upon completing the merge.

## Verification Checklist
1. Verify the Gateway container is running:
   ```bash
   docker ps | grep gini_gateway_dev
   ```
2. Verify the live OpenAPI / Swagger schema matches the latest changes:
   ```bash
   curl -s http://localhost:3000/api/docs-json | jq '.info'
   ```
3. Remind the user to hard-refresh the browser (`Cmd + Shift + R`) if checking Swagger UI or frontend clients.
