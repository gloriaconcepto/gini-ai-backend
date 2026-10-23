# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Phase 1: Infrastructure, Security Foundations & API Contracts

## Current Goal

- Establish the local Docker environment, build core NestJS Maker-Checker authorization guards, and generate the strict OpenAPI (Swagger) contract to unblock frontend agents.

## Completed

- Defined Terraform configuration for ACA, PostgreSQL, Redis, Keycloak, and Gateway.
- Provided local `docker-compose.yml` (with `ankane/pgvector:v0.5.1`, Redis 7, Keycloak 24).
- Reserved `snet-vllm-gpu` subnet for future GPU deployment.
- Initialized NestJS Gateway with Keycloak Service for dynamic tenant realm provisioning.
- Retroactively applied Swagger/OpenAPI decorators across the Gateway DTOs and Controllers.
- Configured automated default admin provisioning when creating new tenant realms.
- Wired up Azure Key Vault for remote environments and standardized `.env` setup.
- Built comprehensive IAM endpoints (users, roles, SSO/IDPs) for Tenant Admins with strict role guards.
- Completed Epic 1.10: Full User, Role, Client & IdP lifecycle, JWKS client caching, dynamic tenantId extraction, standard governance roles auto-provisioning (`maker`, `checker`, `auditor`, `user`, `admin`), Tenant API Key management & ApiKeyGuard.
- Configured newly provisioned tenant realms to use the `gini-ai` theme by default.
- Adjusted tenant creation endpoint to provision frontend client, default governance roles (Maker, Checker, Auditor, User, Admin), and return clean frontend response DTO.
- Enriched IAM `@Get('users/:userId')` response to include assigned user roles (`roles: string[]`) alongside user profile details with OpenAPI typing and test coverage.
- Updated CreateTenantDto to accept admin first and last names, mapping them directly to Keycloak user attributes during tenant realm provisioning.
- Completed Epic 1.11: Dual-Admin Tenant Provisioning & Admin Role Removal. Provisioned distinct Maker and Checker users, mapped to lowercase `maker` and `checker` governance roles, removed `admin` role from realm role creation and tenant provisioning, and updated OpenAPI contracts and unit tests.
- Completed Epic 1.12: Dual-Admin IAM 'admin' Role Assignment. Pre-provisioned `admin` role among tenant realm governance roles and assigned it to both Maker and Checker admin accounts during tenant onboarding, granting them full IAM permissions for user, IdP, and client management.
- Completed Epic 1.13: Tenant Workspace Details (Realm Representation) Retrieval. Implemented `TenantController` (`GET /tenant/workspace`) guarded by `JwtAuthGuard` to automatically detect workspace context and return full realm representation for all tenant members (admins and regular users) while explicitly forbidding OEM / Master administrators.
- Completed Epic 1.14: Tenant Domain Mapping & Pre-Login Auto-Resolution. Implemented `TenantDomainService` and public endpoint `GET /tenant/resolve` allowing frontend applications to resolve `domain` or `email` into the tenant's `tenantId`, Keycloak realm, and client configuration before authentication. Automatically registered during tenant provisioning.
- Completed Infrastructure Restructuring for Frontend Consolidation: Updated Terraform ACA frontend configuration to provision `ca-enterprise-portal` and `ca-oem-backoffice`, updated outputs, added root `.dockerignore`, expanded gateway deployment workflow triggers, and configured `@gini/oem-backoffice` Keycloak master client.
- Completed Epic 1.15: Comprehensive Audit Log Module & Auditor Role Enforcement. Created enterprise `AuditModule` featuring automatic HTTP mutation interception via `AuditLogInterceptor`, `@Audited` decorator metadata enrichment, `AuditMaskingService` regex/key-based data sanitization, `AuditorGuard` read-only enforcement for the `auditor` role, `InMemoryAuditStorageAdapter` with bounded FIFO eviction, and `AuditController` (`GET /audit/logs`, `GET /audit/logs/:id`, `GET /audit/summary`, `GET /audit/export`) with >95% test coverage.
- Completed Infrastructure Cost Reduction & Environment Power Management: Added `enable_scale_to_zero` Terraform variable to scale HTTP Container Apps (`gateway`, `keycloak`, `enterprise-portal`, `oem-backoffice`) to 0 replicas on idle; created `./scripts/azure-power.sh` with `status`, `stop`, and `start` commands; added npm scripts (`azure:status`, `azure:stop`, `azure:start`); and added `.github/workflows/azure-scheduled-power.yml` for automated off-hours shutdown.
- Completed Epic 2: Maker-Checker Governance. Built in-memory `ChangeRequestStoreService`, `@RequireDualControl` decorator, `MakerCheckerInterceptor` (short-circuiting mutations to `202 Accepted`), `ChangeRequestExecutorService` (action dispatcher against Keycloak), `GovernanceController` (`/iam/governance/requests` with dual-control approval, rejection, and maker self-approval prevention), refactored `IamController` permissions to `@Roles('maker', 'checker', 'admin')` with `@Roles('maker')` on mutations, with 100% unit test coverage and clean OpenAPI decorations.

- Completed Epic 1.16: 3rd-Party IdP Role, Group & Corporate Hierarchy Synchronization. Built complete Keycloak group hierarchy tree CRUD with subgroup nesting, group realm role mappings, and user-group memberships; configured 3rd-party IdP claim mappers (`oidc-role-idp-mapper`, `oidc-group-idp-mapper`, `oidc-user-attribute-idp-mapper`, etc.); built Option A Hybrid Catalog Sync Engine (`POST /iam/idp/:alias/sync`) for on-demand role, department group tree, and metadata replication; wired all mutations into Maker-Checker Dual Control (`@RequireDualControl`); and achieved 100% test coverage across services, controllers, and executor.
- Completed Epic 2.1 (P0): Critical Security Hardening & Vulnerability Remediation. Eliminated `user.username === 'admin'` authorization backdoor from `MasterAdminGuard` with comprehensive test suite; removed `admin` role privilege escalation from `ApiKeyGuard` (defaulting strictly to `['service']`); secured Keycloak admin credentials in Terraform using sensitive variables and Container App secrets; replaced wildcard `['*']` redirect URIs and web origins with domain/config-driven origins in `KeycloakService.provisionTenantRealm`; and hardened Gateway CORS with explicit origin validation.
- Completed Dynamic Tenant Client ID Persistence & Pre-Login Discovery: Fixed hardcoded 'gini-frontend' client ID resolution by persisting tenant client ID into Keycloak realm attributes during onboarding (`SystemController` and `KeycloakService`), implementing 3-tier dynamic resolution in `TenantDomainService` (realm attributes -> realm public SPA client inspection -> configuration default), exposing `clientId` in `TenantWorkspaceResponseDto` (`GET /tenant/workspace`), and adding full unit test coverage.
- Completed Cloud Environment Variable Population & Gateway CORS Configuration: Injected `OEM_BACKOFFICE_URL`, `ALLOWED_ORIGINS`, and `CORS_ORIGINS` into `azurerm_container_app.gateway` via Terraform using the ACA environment default domain, avoiding circular dependencies; added `cors_origins` variable for external domain overrides; hardened Gateway CORS origin validation in `main.ts` with whitespace trimming and trailing slash normalization; added validation schema support for portal and backoffice URLs in `config.validation.ts`; and fixed syntax and origin formatting in `.env.remote`.

## Active Tasks & Epics

- **Epic 2.1:** Security Hardening, Credential Sanitization & Configuration Externalization (Priority 1 - Immediate: Remove guard backdoor & API key admin privilege escalation, fix Terraform hardcoded credentials, sanitize plaintext repo secrets, eliminate wildcard client redirects, standardize environment variable casing & ports).
- **Epic 3:** Database & Tenant Isolation (Priority 2: Drizzle ORM pgvector connection, RLS enforcement, Audit Command Centre schema, and Auditor regex masking).
- Please refer to [agent-epics.md](./agent-epics.md) for the detailed, sequential list of implementation tasks and active epics.

## Architecture Decisions

- **LLM Deferral:** GPU / vLLM deployment paused; infrastructure prepped via `snet-vllm-gpu`.
- **Contract-First Parallelism:** Phase 1 must terminate with an exported OpenAPI spec before starting Phase 2 backend logic, allowing frontend agents to build independently.
- **Dual-Admin IAM Admin Roles:** Tenant onboarding initializes separate Maker and Checker accounts, each assigned their respective governance role (`maker` or `checker`) as well as the `admin` role to provide full IAM access across tenant management endpoints prior to dual-control interception.
- **Automatic Tenant Workspace Resolution:** Tenant applications resolve the current user's workspace via `GET /tenant/workspace`. The gateway extracts `tenantId` cryptographically from the active JWT issuer / custom claims and loads the realm representation directly from Keycloak, rejecting OEM master realm admins.
- **Pre-Login Domain Resolution Table:** To determine the correct Keycloak realm before login, `GET /tenant/resolve` maps corporate domains (e.g. `acme.com`) and work emails (e.g. `user@acme.com`) to `tenantId`, realm name, and client ID via `TenantDomainService`, with automatic fallback to Keycloak realm attributes.
- **In-Memory Dual Control:** Pending Maker state mutations are temporarily captured in-memory pending Checker approval until PostgreSQL persistence (Drizzle ORM) is introduced in Epic 3.
- **Audit Storage Decoupling & Pluggability:** Implemented `IAuditStorageAdapter` with `InMemoryAuditStorageAdapter` for immediate usage, providing a drop-in port for PostgreSQL / Drizzle ORM persistence in Epic 3 without modifying controllers, interceptors, or decorators.
- **Auditor Read-Only & Sensitive Data Redaction:** Enforced that the `auditor` role is mathematically restricted to read-only HTTP methods (`GET`/`HEAD`) via `AuditorGuard`, and all audit payloads are stripped of credentials, secrets, tokens, and PII by default via `AuditMaskingService`.
- **Hybrid IdP Corporate Hierarchy Synchronization:** 3rd-party IdP roles, departments, and metadata are synchronized using a dual approach: (1) JIT Claim Mappers on external IdPs for automatic token-time provisioning and (2) Option A Hybrid Directory Sync (`POST /iam/idp/:alias/sync`) for on-demand replication of the entire organizational hierarchy and role-to-group bindings directly into Keycloak's nested group tree, strictly guarded by Maker-Checker dual control.
- **Dynamic Tenant Client ID Resolution:** Avoided hardcoding frontend client IDs across tenant workspaces by persisting the configured or provisioned client ID in Keycloak realm attributes upon tenant creation. Pre-login discovery (`GET /tenant/resolve`) and post-login workspace discovery (`GET /tenant/workspace`) resolve the client ID dynamically via a 3-tier cascade (realm attributes, realm public client inspection, and config fallback).
- **Cloud Environment Variable Injection & Circular Dependency Prevention:** In Azure Container Apps, frontend applications and API Gateway depend on each other's endpoints (frontend needs Gateway URL; Gateway needs frontend URLs for CORS). To avoid Terraform resource cycle deadlocks (`azurerm_container_app.gateway` <-> `azurerm_container_app.frontend`), Gateway environment variables (`ALLOWED_ORIGINS`, `CORS_ORIGINS`, `OEM_BACKOFFICE_URL`) are computed using the Container App Environment's default domain (`azurerm_container_app_environment.aca_env.default_domain`).
