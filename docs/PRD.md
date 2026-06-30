# Product Brief

## Product Name

Loom

## Summary

Loom is a self-hosted control plane for team LLM access through LiteLLM. It gives operators a way to issue personal LiteLLM virtual keys, manage users and teams, register OpenAI-compatible upstream providers, sync stable model aliases into LiteLLM, and review usage attribution without exposing upstream provider credentials directly to developers.

## Target Users

- Platform and DevOps maintainers who operate shared AI tooling.
- Engineering managers who need basic usage visibility and revocation controls.
- Developers using OpenAI-compatible tools such as Codex CLI, Cursor, Continue, Cline, Roo, or scripts.

## Problem

Team AI access often starts with ad hoc provider keys and shared credentials. That creates operational problems:

- No reliable per-user attribution.
- No simple user offboarding or key revocation path.
- Provider credentials end up on individual machines.
- Model names and provider routes change independently of developer configs.
- Usage and estimated cost are hard to review.

## Current Solution

Loom separates developer access from provider operations:

```text
Developer tool
  -> LiteLLM `/v1` endpoint with personal virtual key
  -> OpenAI-compatible upstream selected by model alias

Operator
  -> Loom admin API/dashboard
  -> LiteLLM admin APIs and Loom metadata database
```

LiteLLM is the request-time source of truth for authentication, virtual keys, model allowlists, supported budgets, proxying, and spend logs. Loom manages the surrounding control-plane workflow.

## Implemented Capabilities

- Create users and optional teams.
- Create and revoke LiteLLM virtual keys.
- Store only hashed local key metadata.
- Register OpenAI-compatible providers.
- Encrypt provider API keys at rest.
- Check provider health with `/v1/models`.
- Create, update, disable, and sync model aliases into LiteLLM.
- Read LiteLLM spend logs for usage summaries.
- Store manual usage records through `/ingest/usage`.
- Track monthly budget records for users or teams.
- Serve an admin dashboard from `/dashboard`.
- Run the stack with Docker Compose.

## Explicit Non-Goals

Loom does not:

- Scrape credentials.
- Pool browser sessions or cookies.
- Store user passwords.
- Bypass provider quotas.
- Resell provider access.
- Store raw prompts or completions by default.
- Make private upstream routers public.

## Success Criteria

- A new operator can start the stack from `.env.example`.
- A developer can receive one personal key and call a stable model alias.
- An operator can revoke a key without rotating upstream provider credentials.
- Provider API keys are not returned by list endpoints.
- Usage summaries can attribute requests to users, keys, teams, and models where LiteLLM spend metadata is available.

## Current Maturity

Loom is pre-1.0 software. The core API, dashboard, provider registry, model alias sync, usage summaries, and Docker Compose workflow exist. Remaining hardening areas include automated retention, alerts, Redis-backed rate limits, broader deployment templates, and production runbooks for specific environments.
