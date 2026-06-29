# Architecture

## Components

- LiteLLM Proxy exposes OpenAI-compatible `/v1` endpoints to developers and tools.
- 9router or another OpenAI-compatible backend is configured as LiteLLM upstream through `NINE_ROUTER_BASE_URL` and `NINE_ROUTER_API_KEY`.
- Control plane API manages internal users, teams, personal API keys, usage ingestion, usage aggregation, and budgets.
- Postgres stores metadata and usage records.
- Redis is included for future rate limiting/cache support.

## Request Flow

```text
Codex/Cursor/scripts
  -> LiteLLM proxy with personal tlg_live key
  -> OpenAI-compatible upstream configured by env
  -> Provider
```

The control plane is the operational source of truth for users, keys, usage, and budgets. The current MVP documents the proxy enforcement boundary; the next phase connects LiteLLM request auth to the control-plane key and budget checks.

## Data Model

- `User`: person who can own multiple keys.
- `Team`: optional grouping for users, keys, usage, and budgets.
- `ApiKey`: hashed personal key with prefix and active/revoked status.
- `UsageRecord`: structured usage event without raw prompts or completions.
- `BudgetLimit`: monthly user/team token and cost limits.

## Security Defaults

- Upstream provider credentials are env-only.
- Personal API keys are returned once and stored hashed.
- Admin endpoints require `ADMIN_TOKEN`.
- Structured logs redact authorization headers and do not log prompts by default.
