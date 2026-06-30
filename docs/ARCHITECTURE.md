# Architecture

## Components

- LiteLLM Proxy exposes OpenAI-compatible `/v1` endpoints to developers and tools. LiteLLM virtual keys are the real user keys.
- 9router or another OpenAI-compatible backend can be configured statically through `ROUTER_BASE_URL` and `ROUTER_API_KEY`, or dynamically through the Phase 3 provider registry.
- Control plane API manages internal users/teams, creates LiteLLM virtual keys through LiteLLM admin APIs, stores hashed key metadata, stores encrypted provider credentials, syncs model aliases into LiteLLM, summarizes LiteLLM spend logs, and keeps local/manual usage ingestion available as a fallback. User attribution is attached to the LiteLLM key; team records are created in LiteLLM when a key belongs to a team.
- Postgres stores metadata and usage records. The control plane uses the `app` schema; LiteLLM uses the separate `litellm` schema so LiteLLM migrations cannot modify app tables.
- Redis is included for future rate limiting/cache support.

## Request Flow

```text
Codex/Cursor/scripts
  -> LiteLLM proxy with personal LiteLLM virtual key
  -> OpenAI-compatible upstream configured by env or provider registry
  -> Provider
```

LiteLLM is the request-time source of truth for auth, model allowlists, LiteLLM-supported budgets, and spend. The control plane is the admin UX/API layer and local metadata store.

## Data Model

- `User`: person who can own multiple keys.
- `Team`: optional grouping for users, keys, usage, and budgets.
- `ApiKey`: hashed local copy of a LiteLLM virtual key plus LiteLLM alias/token reference and active/revoked status.
- `Provider`: OpenAI-compatible upstream target such as local 9Router, `ai.example.com`, OpenAI, or another private gateway. API keys are encrypted with `PROVIDER_SECRET_KEY`; browser sessions are not stored.
- `ModelAlias`: public LiteLLM model alias mapped to a provider and upstream model id, for example `code-premium -> 9router/openai/gemini-2.5-pro`.
- `UsageRecord`: local/manual structured usage event without raw prompts or completions. Default operational usage views read LiteLLM spend logs.
- `BudgetLimit`: monthly user/team token and cost limits.

## Provider-Agnostic Mode

Static env config is still useful for first boot and disaster recovery. For ongoing operations, use:

- `POST /admin/providers` to add an OpenAI-compatible provider URL and API key.
- `GET /admin/providers/:id/health` to verify `/v1/models`.
- `POST /admin/model-aliases` to create a public alias and sync it to LiteLLM.
- `POST /admin/model-aliases/:id/sync` to resync an existing alias.
- `GET /admin/litellm/model-config` to render a redacted YAML view for operator review.

Developers never call provider URLs directly. They call LiteLLM with personal virtual keys and stable aliases such as `code-premium`.

## Security Defaults

- Upstream provider credentials are env-only for static boot config or encrypted at rest for registry-managed providers.
- Personal LiteLLM virtual keys are returned once and stored hashed locally.
- Admin endpoints require `ADMIN_TOKEN`.
- Structured logs redact authorization headers and do not log prompts by default.
- ChatGPT/Gemini browser sessions, cookies, and password automation are explicitly out of scope.
