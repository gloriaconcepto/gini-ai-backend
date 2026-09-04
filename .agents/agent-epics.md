# Agent Epics and Tasks

This document serves as the single source of truth for agents to understand the sequence of implementation tasks for the NestJS Gateway and backend infrastructure.

## Epic 1: Identity & Keycloak Infrastructure (Priority 1)
- [x] Install `@keycloak/keycloak-admin-client` and NestJS Keycloak dependencies.
- [x] Implement `KeycloakService` for dynamic tenant realm provisioning.
- [x] Create Global Auth Guard to extract `tenant_id` from JWT.
- [x] Add the 'admin' role to the 2 new admins (maker & checker) created during tenant onboarding, in order to give them the necessary permissions to create, read, update and delete new users, idps etc.

## Epic 1.5: Retroactive OpenAPI / Swagger Compliance
- [x] Retroactively add Swagger decorators (`@ApiOperation`, `@ApiResponse`, etc.) to existing controllers.
- [x] Retroactively add `@ApiProperty()` and validation decorators to existing DTOs.

## Epic 1.6: Tenant Default Admin Provisioning
- [x] Add `adminEmail` and `adminPassword` to `CreateTenantDto`.
- [x] Implement user and custom `admin` role provisioning in `KeycloakService`.

## Epic 1.7: Azure Key Vault Integration
- [x] Update Terraform to securely store infrastructure secrets in Azure Key Vault.
- [x] Configure Azure Container Apps to map Key Vault secrets to environment variables, OR install `@azure/keyvault-secrets` to fetch them at runtime in NestJS.

## Epic 1.8: Tenant Admin Workspace & IAM
- [x] Implement endpoints for tenant admins to onboard new users into their realm.
- [x] Implement endpoints for viewing existing users within their realm.
- [x] Implement endpoints to create custom roles and assign them to users.
- [x] Implement endpoints to create clients and integrate 3rd-party SSO (Identity Providers).

## Epic 1.9: Master Admin Capabilities & Corporate Metadata
- [x] Extend `CreateTenantDto` with corporate metadata (Industry, Tax ID, etc.).
- [x] Update `KeycloakService` to store metadata in Realm attributes and add master methods.
- [x] Create `MasterAdminGuard` for Keycloak's Master Realm users.
- [x] Create `SystemController` for Master Admins to manage all tenants.

## Epic 1.10: Enterprise Authentication Hardening & IAM Administration Lifecycle (Priority 1)
- [x] Multi-Tenant JWT Strategy Hardening (JWKS client caching per issuer & dynamic tenantId extraction from issuer URL).
- [x] Complete User Lifecycle Management (GET user details, PATCH user profile/status, DELETE user, PUT admin password reset).
- [x] User Role Mapping Endpoints (GET user roles, DELETE role mapping from user).
- [x] Role Lifecycle & Default Governance Roles (GET roles list, DELETE custom role, auto-provision `maker`, `checker`, `auditor`, `user`, `admin` on realm creation).
- [x] Client & Identity Provider Management (GET clients list, GET client secret, DELETE client, GET/PATCH/DELETE Identity Providers).
- [x] Default Frontend Client Provisioning (auto-configure SPA client with web origins and token mappers during realm creation).
- [x] Tenant API Key Lifecycle & Dual Auth Guard (Issue, list, revoke API keys; implement `ApiKeyAuthGuard` / Unified Auth Guard).
- [x] Master Admin Tenant Controls & Exception Mapping (Enable/disable realm toggle, map Keycloak errors to NestJS HTTP exceptions).

## Epic 1.11: Dual-Admin Tenant Provisioning & Admin Role Removal
- [x] Remove `admin` and `Admin` roles from default governance role provisioning during tenant realm creation (retaining lowercase `maker`, `checker`, `auditor`, `user`).
- [x] Update `CreateTenantDto` to accept credentials for both Maker (`makerEmail`, `makerPassword`, `makerFirstName`, `makerLastName`) and Checker (`checkerEmail`, `checkerPassword`, `checkerFirstName`, `checkerLastName`).
- [x] Update `KeycloakService.provisionTenantRealm` to provision two distinct users (Maker assigned `maker` role, Checker assigned `checker` role) and remove `admin` role mapping.
- [x] Update `CreateTenantResponseDto` to return dual-provisioned user metadata and exclude `admin` from default roles.
- [x] Update unit tests in `keycloak.service.spec.ts` and `system.controller.spec.ts`.

## Epic 1.12: Dual-Admin IAM 'admin' Role Assignment
- [x] Add the 'admin' role to the 2 new admins (maker & checker) created during tenant onboarding, in order to give them the necessary permissions to create, read, update and delete new users, idps etc.

## Epic 2: Maker-Checker Governance (Priority 1)
- [ ] Create in-memory `ChangeRequestStoreService` to store and manage pending actions (`PENDING`, `APPROVED`, `REJECTED`, `EXECUTED`).
- [ ] Create `@RequireDualControl(actionType)` decorator to mark state-changing routes in `IamController`.
- [ ] Implement `MakerCheckerInterceptor` / `MakerCheckerGuard`:
  - When a user with the `maker` role initiates a dual-control action, intercept execution, store the action payload in the in-memory store, and return `202 Accepted` with the change request details.
  - Reject attempts if the user lacks the `maker` role for dual-control routes.
- [ ] Implement Tenant Governance Controller (`/iam/governance/requests`):
  - `GET /iam/governance/requests`: List pending/historical change requests for the tenant.
  - `GET /iam/governance/requests/:id`: View details and payload of a specific request.
  - `POST /iam/governance/requests/:id/approve`: Approve and execute the underlying action against Keycloak; enforce `checker` role and invariant `checkerId !== makerId`.
  - `POST /iam/governance/requests/:id/reject`: Reject the pending request with review comments.
- [ ] Refactor `IamController` permissions: remove `@Roles('admin')` and replace with `@Roles('maker', 'checker')` (or role-specific permissions per endpoint).
- [ ] Add unit and e2e tests covering maker submission, checker approval execution, checker rejection, and self-approval prevention (`checkerId === makerId`).

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
