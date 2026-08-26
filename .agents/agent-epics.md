# Agent Epics and Tasks

This document serves as the single source of truth for agents to understand the sequence of implementation tasks for the NestJS Gateway and backend infrastructure.

## Epic 1: Identity & Keycloak Infrastructure (Priority 1)
- [x] Install `@keycloak/keycloak-admin-client` and NestJS Keycloak dependencies.
- [x] Implement `KeycloakService` for dynamic tenant realm provisioning.
- [x] Create Global Auth Guard to extract `tenant_id` from JWT.

## Epic 2: Maker-Checker Governance (Priority 1)
- [ ] Create `@RequireDualControl()` decorator.
- [ ] Implement `MakerCheckerGuard` to enforce Maker != Checker logic on state-changing routes.

## Epic 3: Database & Tenant Isolation (Priority 2)
- [ ] Configure Drizzle ORM to connect to the local `pgvector` instance.
- [ ] Bind `tenant_id` to Drizzle ORM context for strict Row-Level Security (RLS) enforcement.
- [ ] Implement the Audit Command Centre read-only schema.
- [ ] Implement a regex-masking interceptor for the System Auditor role.

## Epic 4: API Contracts (Phase 1 Gate)
- [ ] Setup `@nestjs/swagger` with `DocumentBuilder` in `main.ts`.
- [ ] Decorate all Controllers/DTOs (`@ApiOperation`, `@ApiProperty`, etc.).
- [ ] Create `npm run openapi:generate` script to export `openapi.json` to unblock frontend agents.

## Epic 5: Asynchronous Queues & AI Stubbing (Phase 2 Prep)
- [ ] Configure `@nestjs/bullmq` with Redis.
- [ ] Scaffold Doc AI ingestion workers.
- [ ] Create `ILlmProvider` and implement a static mock service (GPU dependencies paused).
