# Backend Architecture Context

## Technology Stack & Deployment
- **Framework:** NestJS + TypeScript (Azure Container Apps for Dev/Prod, Docker Compose for Local).
- **Database:** PostgreSQL 16 + `pgvector` (Azure Flexible Server in Prod, `ankane/pgvector` locally).
- **Cache & Message Broker:** Redis 7 (Azure Container Apps in Prod, Docker Compose locally).
- **Identity:** Keycloak 24 (Deployed natively on Azure Container Apps and Docker Compose).
- **AI Hardware:** GPU provisioning is explicitly disabled for now. The `snet-vllm-gpu` subnet is retained in Terraform for future integration.

## Core Systems
### 1. Identity & Tenant Provisioning
The NestJS Dashboard backend utilizes the Keycloak Admin REST API (`@keycloak/keycloak-admin-client`) authenticated via the master realm to dynamically provision single realms per tenant.

### 2. Database Schema & RLS
A shared PostgreSQL database uses a schema-per-tenant isolation model. Cross-tenant leakage is mathematically prevented via Row-Level Security (RLS) policies tied to the `tenant_id` session variable.

### 3. Unified Gateway & AI Routing
The NestJS AI Gateway handles Keycloak OIDC authentication, tracks API traffic/tenant usage, manages local API keys, and routes requests to the appropriate capability domain.

### 4. Frontend Applications
The frontend presentation layer consists of 4 isolated single-page application (SPA) Container Apps deployed with external HTTPS ingress on Azure Container Apps:
- **Manager App (`ca-manager-app`):** Platform operations and tenant management.
- **OEM Backoffice (`ca-oem-backoffice`):** OEM administration and white-label governance.
- **Tenant Admin (`ca-tenant-admin`):** Tenant workspace, IAM user/role configuration, and identity provider integration.
- **User App (`ca-user-app`):** End-user enterprise intelligence interface (Doc AI, Data AI, Agentic AI).