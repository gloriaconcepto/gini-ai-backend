<!-- BEGIN:nestjs-agent-rules -->

# This is a Strict NestJS + PostgreSQL (Drizzle) Backend

This backend enforces strict schema-per-tenant data isolation, Maker-Checker governance, and multi-role authorization. Do not invent arbitrary API endpoints or guess schemas. Read the architecture and context files thoroughly before writing any code.

**CRITICAL CONSTRAINT:** GPU provisioning and LLM integration are currently disabled. Focus entirely on building the NestJS authorization layer, Keycloak integration, Drizzle ORM schemas, and BullMQ queue infrastructure using the provided local `docker-compose.yml` stack.

<!-- END:nestjs-agent-rules -->

## Application Building Context

Read the following files in order before implementing or making any architectural decision:

1. `product-requirements.md` — Product definition, goals, and the deferred scope of the AI models.
2. `architecture-context.md` — System structure, the Azure Container Apps topology, the Docker Compose local setup, and Keycloak tenant provisioning.
3. `code-standards.md` — NestJS implementation rules, structured logging, Drizzle ORM standards, and Auditor data masking requirements.
4. `ai-workflow-rules.md` — Development workflow, infrastructure-first rules, and how to handle the temporary absence of LLM models.
5. `agent-epics.md` — The structured sequence of implementation tasks and epics.
6. `progress-tracker.md` — Current phase, completed work, and high-level goals.

Update `progress-tracker.md` and check off tasks in `agent-epics.md` after each meaningful implementation change.
