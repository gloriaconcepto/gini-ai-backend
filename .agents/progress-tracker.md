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

## In Progress
- Developing `@RequireDualControl()` decorator and `MakerCheckerGuard` in NestJS Gateway.
- Configuring Keycloak realm provisioning via `@keycloak/keycloak-admin-client`.

## Next Up
- **Phase 1 Contract Gate:** Enforce automated OpenAPI / Swagger specification export (`openapi.json`) to unblock parallel React/Vite UI development.
- Build read-only Audit Command Centre schema and masking interceptors for System Auditor.
- Set up BullMQ queues and worker scaffolding for Doc AI ingestion.

## Architecture Decisions
- **LLM Deferral:** GPU / vLLM deployment paused; infrastructure prepped via `snet-vllm-gpu`.
- **Contract-First Parallelism:** Phase 1 must terminate with an exported OpenAPI spec before starting Phase 2 backend logic, allowing frontend agents to build independently.