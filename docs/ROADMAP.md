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

- Integrate LiteLLM virtual keys or auth callbacks with control-plane keys.
- Enforce active/revoked key status before forwarding.
- Enforce monthly token and cost budgets at request time.
- Forward LiteLLM success/error logs into `/ingest/usage`.

## Phase 3: Operations

- Add retention jobs and monthly reports.
- Add Redis-backed rate limits.
- Add deployment templates.
- Add alerts for high spend, high error rates, and provider outage.

## Phase 4: Minimal Dashboard

- Add a small internal dashboard only if the CLI/API workflow becomes a bottleneck.
- Keep it admin-only and focused on users, keys, budgets, and usage charts.
