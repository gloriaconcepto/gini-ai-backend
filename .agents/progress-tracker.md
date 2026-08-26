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

## Active Tasks & Epics
- Please refer to [agent-epics.md](./agent-epics.md) for the detailed, sequential list of implementation tasks and active epics.

## Architecture Decisions
- **LLM Deferral:** GPU / vLLM deployment paused; infrastructure prepped via `snet-vllm-gpu`.
- **Contract-First Parallelism:** Phase 1 must terminate with an exported OpenAPI spec before starting Phase 2 backend logic, allowing frontend agents to build independently.