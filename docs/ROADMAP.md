# Roadmap

## Phase 1: MVP Foundation

- Fastify control plane.
- Prisma/Postgres schema.
- Hashed personal keys.
- Usage ingestion and aggregation.
- Budget service logic.
- LiteLLM config with OpenAI-compatible upstream env vars.
- Docker Compose local stack.

## Phase 2: Proxy Enforcement

Status: implemented as LiteLLM virtual-key bridging.

- Integrate LiteLLM virtual keys or auth callbacks with control-plane keys.
- Enforce active/revoked key status before forwarding.
- Enforce monthly token and cost budgets at request time.
- Forward LiteLLM success/error logs into `/ingest/usage`.

Current implementation creates and revokes LiteLLM virtual keys directly, attaches user/team metadata, assigns model allowlists, maps budget fields supported by LiteLLM, and reads LiteLLM spend logs for usage views. `/ingest/usage` remains available for future custom log forwarding.

## Phase 3: Provider-Agnostic Operations

Status: implemented as provider registry APIs and LiteLLM dynamic model sync.

- Add encrypted provider registry for OpenAI-compatible upstreams.
- Support local 9Router, `ai.company.com`, OpenAI-compatible vendor endpoints, and local model servers through the same model alias UX.
- Add model alias registry and LiteLLM `/model/new` sync.
- Add provider health checks against `/v1/models`.
- Add redacted LiteLLM model config render endpoint for operators.

Not included: browser session/password automation, provider OAuth UX, or full web dashboard.

## Phase 4: Operations Hardening

- Add retention jobs and monthly reports.
- Add Redis-backed rate limits.
- Add deployment templates.
- Add alerts for high spend, high error rates, and provider outage.

## Phase 5: Minimal Dashboard

- Add a small internal dashboard only if the CLI/API workflow becomes a bottleneck.
- Keep it admin-only and focused on users, keys, providers, model aliases, budgets, and usage charts.
