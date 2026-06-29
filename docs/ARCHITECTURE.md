# Architecture

## Components

- LiteLLM Proxy exposes OpenAI-compatible `/v1` endpoints to developers and tools. LiteLLM virtual keys are the real user keys.
- 9router or another OpenAI-compatible backend is configured as LiteLLM upstream through `ROUTER_BASE_URL` and `ROUTER_API_KEY`. Legacy `NINE_ROUTER_*` values may be mapped into `ROUTER_*` by Compose.
- Control plane API manages internal users/teams, creates LiteLLM virtual keys through LiteLLM admin APIs, stores hashed key metadata, summarizes LiteLLM spend logs, and keeps local/manual usage ingestion available as a fallback. User attribution is attached to the LiteLLM key; team records are created in LiteLLM when a key belongs to a team.
- Postgres stores metadata and usage records. The control plane uses the `app` schema; LiteLLM uses the separate `litellm` schema so LiteLLM migrations cannot modify app tables.
- Redis is included for future rate limiting/cache support.

## Request Flow

```text
Codex/Cursor/scripts
  -> LiteLLM proxy with personal LiteLLM virtual key
  -> OpenAI-compatible upstream configured by env
  -> Provider
```

LiteLLM is the request-time source of truth for auth, model allowlists, LiteLLM-supported budgets, and spend. The control plane is the admin UX/API layer and local metadata store.

## Data Model

- `User`: person who can own multiple keys.
- `Team`: optional grouping for users, keys, usage, and budgets.
- `ApiKey`: hashed local copy of a LiteLLM virtual key plus LiteLLM alias/token reference and active/revoked status.
- `UsageRecord`: local/manual structured usage event without raw prompts or completions. Default operational usage views read LiteLLM spend logs.
- `BudgetLimit`: monthly user/team token and cost limits.

## Security Defaults

- Upstream provider credentials are env-only.
- Personal LiteLLM virtual keys are returned once and stored hashed locally.
- Admin endpoints require `ADMIN_TOKEN`.
- Structured logs redact authorization headers and do not log prompts by default.
