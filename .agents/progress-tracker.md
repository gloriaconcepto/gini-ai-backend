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

## Active Tasks & Epics

- **Epic 2:** Maker-Checker Governance (in-memory change request staging and Checker approval workflow for Tenant Admin actions).
- Please refer to [agent-epics.md](./agent-epics.md) for the detailed, sequential list of implementation tasks and active epics.

## Architecture Decisions

- **LLM Deferral:** GPU / vLLM deployment paused; infrastructure prepped via `snet-vllm-gpu`.
- **Contract-First Parallelism:** Phase 1 must terminate with an exported OpenAPI spec before starting Phase 2 backend logic, allowing frontend agents to build independently.
- **Dual-Admin IAM Admin Roles:** Tenant onboarding initializes separate Maker and Checker accounts, each assigned their respective governance role (`maker` or `checker`) as well as the `admin` role to provide full IAM access across tenant management endpoints prior to dual-control interception.
- **In-Memory Dual Control:** Pending Maker state mutations are temporarily captured in-memory pending Checker approval until PostgreSQL persistence (Drizzle ORM) is introduced in Epic 3.
