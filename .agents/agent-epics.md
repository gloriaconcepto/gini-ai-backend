# Agent Epics and Tasks

This document serves as the single source of truth for agents to understand the sequence of implementation tasks for the NestJS Gateway and backend infrastructure.

---

## Phase 1: Security Foundations, Governance & API Contracts

### Epic 1: Identity & Multi-Tenant Realm Provisioning (Priority 1)

- [x] Install `@keycloak/keycloak-admin-client` and NestJS Keycloak dependencies.
- [x] Implement `KeycloakService` for dynamic tenant realm provisioning.
- [x] Create Global Auth Guard (`JwtAuthGuard`) to extract `tenant_id` from JWT.
- [x] Implement user and custom `admin` role provisioning in `KeycloakService`.
- [x] Configure newly provisioned tenant realms to use the `gini-theme` branding by default.
- [x] Auto-provision default frontend SPA client (`gini-frontend`) with web origins and token mappers during realm creation.
- [x] Provision dual admin accounts (Maker and Checker) during tenant onboarding:
  - [x] Update `CreateTenantDto` to accept credentials for both Maker (`makerEmail`, `makerPassword`, `makerFirstName`, `makerLastName`) and Checker (`checkerEmail`, `checkerPassword`, `checkerFirstName`, `checkerLastName`).
  - [x] Map distinct `maker` and `checker` governance roles to each admin.
  - [x] Assign the `admin` role to both Maker and Checker to give them full IAM administration permissions across tenant resources.
  - [x] Update `CreateTenantResponseDto` and unit tests.
- [x] Implement Tenant Workspace Details endpoint:
  - [x] Create `TenantWorkspaceResponseDto` defining structured realm representation.
  - [x] Implement `TenantController` with `GET /tenant/workspace` guarded by `JwtAuthGuard` (accessible to all tenant members, explicitly rejecting OEM/master admins).
- [x] Implement Tenant Domain Mapping & Pre-Login Auto-Resolution:
  - [x] Create `TenantDomainMapping` entity and resolution DTOs.
  - [x] Implement `TenantDomainService` with domain/email normalization, in-memory mapping table, and Keycloak realm attribute fallback sync.
  - [x] Auto-register domain mappings during tenant provisioning.
  - [x] Expose public auto-resolution endpoint `GET /tenant/resolve` (`@Public()`).
  - [x] Persist `clientId` in realm attributes and dynamically resolve client IDs without hardcoding.

### Epic 2: Enterprise IAM Administration & Corporate Hierarchy Synchronization (Priority 1)

- [x] Multi-Tenant JWT Strategy Hardening:
  - [x] JWKS client caching per issuer and dynamic `tenantId` extraction from issuer URL.
- [x] Complete User Lifecycle Management:
  - [x] Endpoints for tenant admins to onboard new users, view users, fetch details with assigned roles, update status/profiles, delete users, and reset passwords.
- [x] Role Lifecycle Management:
  - [x] Endpoints to create, list, and delete custom roles, and assign/remove roles from users.
  - [x] Auto-provision standard governance roles (`maker`, `checker`, `auditor`, `user`, `admin`) on realm creation.
- [x] Client & Identity Provider Management:
  - [x] Endpoints to list clients, fetch client secrets, delete clients, and manage Identity Providers (CRUD).
- [x] Tenant API Key Lifecycle & Dual Auth Guard:
  - [x] Issue, list, and revoke API keys with secure prefix/hash generation (`ApiKeyService`).
  - [x] Implement `ApiKeyAuthGuard` / Unified Auth Guard.
- [x] Keycloak Hierarchical Groups & Corporate Hierarchy Management:
  - [x] CRUD operations for Keycloak Groups and nested sub-groups representing organizational hierarchy.
  - [x] Group realm role mappings and attribute metadata assignment.
  - [x] User-group membership operations (add, list, remove).
  - [x] Expose group management endpoints in `IamController` (`GET /iam/groups`, `POST /iam/groups`, `POST /iam/groups/:groupId/children`, etc.).
- [x] Identity Provider Mapper Infrastructure:
  - [x] Endpoints and methods to configure Keycloak IdP Mappers (`oidc-role-idp-mapper`, `oidc-group-idp-mapper`, `oidc-user-attribute-idp-mapper`, `saml-role-idp-mapper`).
  - [x] Support mapping external role claims to realm roles, group claims to hierarchical groups, and corporate metadata (title, department, manager, employee ID) to user attributes.
  - [x] Endpoints in `IamController` (`GET /iam/idp/:alias/mappers`, `POST /iam/idp/:alias/mappers`, `DELETE /iam/idp/:alias/mappers/:mapperId`).
- [x] IdP Discovery & Catalog Hierarchy Sync Service:
  - [x] Option A Hybrid Sync Engine: support direct directory import and native IdP directory synchronization.
  - [x] Endpoint `POST /iam/idp/:alias/sync` guarded by dual control (`SYNC_IDP_HIERARCHY`).
- [x] Master Admin Tenant Controls & Exception Mapping:
  - [x] Master realm controls (`SystemController`) for Master Admins to manage all tenants, toggle realm enable/disable status, and map Keycloak errors to NestJS HTTP exceptions.

### Epic 3: Maker-Checker Governance & Dual-Control Engine (Priority 1)

- [x] Create in-memory `ChangeRequestStoreService` managing pending mutations (`PENDING`, `APPROVED`, `REJECTED`, `EXECUTED`).
- [x] Create `@RequireDualControl(actionType)` decorator to mark state-changing routes in `IamController`.
- [x] Implement `MakerCheckerInterceptor` / `MakerCheckerGuard`:
  - [x] When a user with the `maker` role initiates a dual-control action, intercept execution, store the action payload in the change request store, and return `202 Accepted` with request details.
  - [x] Reject mutations if the user lacks the `maker` role.
- [x] Implement Tenant Governance Controller (`/iam/governance/requests`):
  - [x] `GET /iam/governance/requests`: List pending/historical change requests for the tenant.
  - [x] `GET /iam/governance/requests/:id`: View details and payload of a specific request.
  - [x] `POST /iam/governance/requests/:id/approve`: Approve and execute underlying action against Keycloak; enforce `checker` role and strict invariant `checkerId !== makerId`.
  - [x] `POST /iam/governance/requests/:id/reject`: Reject pending request with review comments.
- [x] Implement `ChangeRequestExecutorService` to execute all dual-control actions upon checker approval (users, roles, groups, mappers, directory sync).
- [x] Refactor `IamController` permissions to `@Roles('maker', 'checker', 'admin')` with `@Roles('maker')` on mutations.
- [x] Add unit and e2e test suite covering submission, execution, rejection, and self-approval prevention.

### Epic 4: Comprehensive Audit Log Module & Auditor Isolation (Priority 1)

- [x] Create domain types and storage interface (`AuditActionCategory`, `AuditStatus`, `AuditActor`, `AuditLogEntry`, `IAuditStorageAdapter`).
- [x] Implement `AuditMaskingService` for recursive key-based and regex-based sanitization of credentials, secrets, tokens, credit cards, and PII.
- [x] Implement `InMemoryAuditStorageAdapter` with bounded FIFO eviction, multi-tenant isolation, date filtering, pagination, and summary metrics calculation.
- [x] Implement `AuditService` for fail-safe asynchronous log persistence, querying, metrics aggregation, and CSV/JSON export.
- [x] Implement `@Audited()` and `@SkipAudit()` decorators and global `AuditLogInterceptor` for automatic capture of mutating HTTP actions and route metadata.
- [x] Implement `AuditorGuard` enforcing strict read-only access (`GET`/`HEAD`) for users with the `auditor` role.
- [x] Implement `AuditController` with OpenAPI-decorated endpoints (`GET /audit/logs`, `GET /audit/logs/:id`, `GET /audit/summary`, `GET /audit/export`).
- [x] Wire `AuditModule` into `GatewayModule` as global interceptor (`APP_INTERCEPTOR`).
- [x] Achieve >95% test coverage across services, interceptors, adapters, guards, and controllers.

### Epic 5: Security Hardening, Configuration Externalization & Constants Normalization (Priority 1)

- [x] Security Vulnerability Remediation (P0):
  - [x] Remove hardcoded backdoor `user.username === 'admin'` from `MasterAdminGuard`; enforce strict cryptographic master realm roles (`admin`, `realm-admin`, `manage-realm`).
  - [x] Fix privilege escalation in `ApiKeyGuard`: remove default `admin` role grant from API keys, defaulting strictly to `['service']`.
  - [x] Remove hardcoded `KEYCLOAK_ADMIN` credentials from Terraform; wire via sensitive Terraform variables / Azure Key Vault.
  - [x] Restrict tenant SPA client redirect URIs and web origins in `KeycloakService.provisionTenantRealm` to avoid open wildcard redirects.
  - [x] Constrain CORS origin reflection using environment-driven origin whitelisting in Gateway `main.ts`.
- [x] Secret Sanitization & Environment Externalization (P1):
  - [x] Remove committed plaintext secrets from Terraform files and environment files.
  - [x] Externalize seed secrets in `master-realm.json` and Keycloak scripts to consume environment variables with secure fallback generation.
  - [x] Standardize environment variable casing to `process.env.PORT` across `apps/gateway` and `apps/workers`.
  - [x] Disambiguate default worker service port (`3001` for workers to prevent port collision with gateway on `3000`).
- [x] Codebase Magic Numbers & Constants Cleanup (P2):
  - [x] Refactor magic numbers (`65536` max header size, `jwksRequestsPerMinute: 10`, `export limit: 5000`, API key entropy/prefix lengths) into centralized constants in `auth.constants.ts`, `audit.constants.ts`, and `server.constants.ts`.
  - [x] Centralize hardcoded realm conventions (`tenant-` prefix, `/realms/master`, `gini-frontend`, `gini-theme`) into unified configuration tokens.

### Epic 6: API Contracts & OpenAPI Specification Export (Phase 1 Gate — Completed)

- [x] Configure `@nestjs/swagger` with `DocumentBuilder` in `apps/gateway/src/main.ts`.
- [x] Decorate all Controllers, Handlers, and DTOs across Gateway modules with `@ApiOperation()`, `@ApiResponse()`, `@ApiProperty()`, and validation decorators.
- [x] Implement standalone OpenAPI generator script `scripts/export-openapi.ts` to serialize the Swagger document without starting the HTTP listener.
- [x] Add `npm run openapi:generate` script in `package.json`.
- [x] Generate and export `/contracts/openapi.json` to unblock frontend agents.
- [x] Add CI/build verification ensuring `/contracts/openapi.json` is always synchronized with code annotations (`npm run openapi:check` and automated contract regression tests).

---

## Phase 2: Persistence, Tenant Isolation & Asynchronous Queues

### Epic 7: Multi-Tenant PostgreSQL Persistence & Drizzle ORM Isolation (Priority 1)

- [ ] Install Drizzle ORM dependencies (`drizzle-orm`, `drizzle-kit`, `pg`, `@types/pg`).
- [ ] Configure database connection module connecting to local `pgvector` container and Azure/AWS RDS in remote environments.
- [ ] Define Master/System schema (tenants, domain mappings, system metadata).
- [ ] Define Tenant schemas with Row-Level Security (RLS) policies tied to `tenant_id` session context.
- [ ] Implement `DrizzleAuditStorageAdapter` (implementing `IAuditStorageAdapter`) to persist audit logs in PostgreSQL, replacing `InMemoryAuditStorageAdapter`.
- [ ] Implement `DrizzleChangeRequestStoreAdapter` to persist Maker-Checker change requests in PostgreSQL, replacing in-memory state.
- [ ] Add database migration tooling and seed scripts (`npm run db:migrate`, `npm run db:seed`).
- [ ] Achieve $\ge$90% test coverage for database repositories, adapters, and RLS isolation.

### Epic 8: Distributed Task Queues & BullMQ Worker Architecture (Priority 2)

- [ ] Configure `@nestjs/bullmq` and Redis 7 broker in `apps/workers` and `apps/gateway`.
- [ ] Define shared queue token contracts in `libs/contracts` (`DOC_INGESTION_QUEUE`, `AUDIT_EXPORT_QUEUE`, `IDP_SYNC_QUEUE`).
- [ ] Configure BullMQ job producers in `apps/gateway`.
- [ ] Scaffold dedicated job processors and worker modules in `apps/workers/src/processors/`.
- [ ] Implement worker error handling, exponential backoff retries, dead-letter queues (DLQ), and structured telemetry.
- [ ] Implement worker health check probes (`/health/liveness`, `/health/readiness`).

---

## Phase 3: AI Inference & Document Ingestion Pipeline

### Epic 9: AI Layer Abstractions & Multi-Cloud Infrastructure (Completed)

- [x] Provider abstractions (`ILlmProvider`, `IEmbeddingProvider`, `IVectorStore`).
- [x] Implement `MockLlmService` for local offline Docker execution.
- [x] Implement AWS SageMaker LLM and Embedding runtime integration services (`@aws-sdk/client-sagemaker-runtime`).
- [x] Implement OpenSearch vector service (`@opensearch-project/opensearch`) supporting k-NN vector search and BM25 hybrid search.
- [x] Implement `RagOrchestratorService` for end-to-end grounded query execution and batch chunk indexing.
- [x] Expose `AiController` with full OpenAPI/Swagger annotations (`/ai/generate`, `/ai/embeddings`, `/ai/rag/query`, `/ai/rag/index`).
- [x] Dynamic `AiModule` factory resolving remote AWS services in production and `MockLlmService` locally.
- [x] Architect multi-cloud Terraform stacks for Azure Container Apps and AWS ECS/RDS/Redis.
- [x] Operations & power control automation (`scripts/aws-power.sh`, `scripts/azure-power.sh`).

### Epic 10: Multi-Tenant S3 Document Ingestion & Authorization Metadata Contract (Decoupled RAG Pipeline)

- [x] S3 Storage Port & Adapters:
  - [x] Install `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
  - [x] Implement `IStorageService` interface, `S3StorageService` (AWS SDK v3), and `MockStorageService` for local/offline testing.
  - [x] Configure S3 layout `s3://gini-rag-documents/<tenant-id>/` with default region `us-west-2`.
- [x] Deterministic S3 File Pairing Contract (Schema v1.0):
  - [x] Auto-generate matching metadata JSON using identical filename stem: `{filename-stem}.{ext}` and `{filename-stem}.metadata.json`.
  - [x] Enforce Schema v1.0 contract: `schema_version`, `tenant_id`, `document` (id, name, version, categories), `access` (departments, allowed_users, excluded_users), `metadata` (updated_at).
- [x] Decoupled Authorization Lifecycle:
  - [x] Implement `PATCH /documents/:id/access` to update department and user permissions and rewrite `{filename-stem}.metadata.json` directly on S3 without re-uploading or reprocessing the source document.
- [x] Direct Upload & State Machine:
  - [x] Presigned PUT URL generation via `POST /documents/upload-url` (status: `PENDING_UPLOAD`).
  - [x] Direct multipart streaming fallback via `POST /documents/upload`.
  - [x] Verification and completion via `POST /documents/:id/complete` (S3 HeadObject verification, write metadata JSON, transition to `UPLOADED`).
  - [x] Query and status display via `GET /documents/:id`, `GET /documents` (paginated, filters), and `GET /documents/summary`.
  - [x] Secure presigned download via `GET /documents/:id/download-url`.
  - [x] Purge file pair from S3 via `DELETE /documents/:id`.
- [x] Persistence & Tenant Isolation:
  - [x] Implement `InMemoryDocumentRepository` implementing `IDocumentRepository` with strict `tenantId` isolation (prepped for Drizzle ORM in Epic 7).
- [x] Contracts & Coverage:
  - [x] Export updated OpenAPI specification into `/contracts/openapi.json` (51 paths, 54 schemas).
  - [x] Achieve >95% test coverage across repository, service, storage adapters, and controller.
