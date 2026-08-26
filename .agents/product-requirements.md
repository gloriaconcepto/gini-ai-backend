# Backend Product Requirements: Gini Enterprise AI

## Overview
A secure, multi-tenant enterprise intelligence platform encompassing Doc AI (Enterprise Knowledge), Data AI (Conversational Analytics), and Agentic AI (Bounded Automation).

## Immediate Delivery Scope (Phase 1)
Due to hardware constraints, the immediate focus is strictly on the foundational infrastructure and governance platform:
1. **Containerized Infrastructure:** Ensure the NestJS Gateway, Keycloak, PostgreSQL, and Redis run identically via local `docker-compose.yml` and Azure Container Apps.
2. **Tenant Onboarding:** Automate the creation of isolated Keycloak realms and API keys via the NestJS Dashboard backend.
3. **Maker-Checker Governance:** Build the strict backend API guards required to enforce that state-changing configurations undergo a separate Maker submission and Checker approval process without edit capabilities.

## Deferred Capabilities
- GPU-bound tasks, including `vLLM` reasoning, open-weight embeddings (`Qwen3-Embedding-8B`), and cross-encoder reranking, are paused until the hardware is secured.