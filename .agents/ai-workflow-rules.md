# AI Development Workflow Rules

## Approach
Implement features incrementally according to architecture specifications. Prioritize security, multi-tenancy, and data governance boundaries before AI capabilities.

## Scoping & Implementation Steps
1. **Infrastructure First (Local Parity):** Rely on `docker-compose.yml` for local testing of Keycloak, Redis, and PostgreSQL (`pgvector`) before deploying to Azure Container Apps.
2. **Identity & Governance:** Implement Keycloak realm provisioning followed immediately by the Maker-Checker guard logic (`@RequireDualControl`).
3. **OpenAPI / Swagger Contract Export (Phase 1 Gate):** 
   - All NestJS DTOs and Controllers must be decorated with `@nestjs/swagger` decorators (`@ApiProperty`, `@ApiOperation`, `@ApiResponse`).
   - Before Phase 1 is marked complete, generate and export `swagger.json`/`openapi.json` into `/contracts/openapi.json`.
   - This contract gate is mandatory so frontend agents can build the React/Vite SPA in parallel without backend blockers.
4. **Queue Scaffolding:** Set up BullMQ on Redis for asynchronous document processing.
5. **LLM Placeholder:** Stub all AI capabilities behind `ILlmProvider` returning static mock responses until GPU hardware is provisioned.

## Keeping Docs In Sync
- Update `/contracts/openapi.json` whenever controller signatures, DTOs, or route definitions change.