# Code Standards (Gini Enterprise AI)

## General & TypeScript
- Strict mode is mandatory (`strict: true` in `tsconfig.json`). Avoid `any`.
- Strict **90% test coverage** required across services, guards, and workers.

## API Documentation & Contracts (OpenAPI / Swagger)
- Every controller method MUST include `@ApiOperation()`, `@ApiResponse()`, and `@ApiTags()`.
- Every input and output DTO property MUST be typed and decorated with `@ApiProperty()` or `@ApiPropertyOptional()` matching `class-validator` rules.
- Run `npm run openapi:generate` to emit the synchronized `openapi.json` spec whenever endpoints change.

## API & Authorization Boundaries (Governance Priority)
- **Maker-Checker Enforcement:** `@RequireDualControl()` must ensure Maker ID != Checker ID.
- **Auditor Isolation:** System Auditor requests are read-only (`GET`/`HEAD`) and sensitive data is regex-masked by default.
- **Tenant Isolation:** Tenant ID must be extracted from Keycloak JWT and bound to Drizzle ORM context on every transaction.

## Database & Local Environment
- Use `ankane/pgvector:v0.5.1` locally via `docker-compose.yml` for testing vector operations.