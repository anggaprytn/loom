# Security

## Hard Boundaries

This project must not implement credential scraping, quota bypassing, password sharing automation, browser cookie reuse, or storage of user passwords. Upstream provider credentials must be operator-provided through environment variables or the encrypted provider registry and used only for authorized provider accounts.

## Threat Model

### Leaked Team Key

Impact: unauthorized usage attributed to a user or team.

Controls:

- Store only hashed local copies of LiteLLM virtual keys.
- Return plaintext key only once.
- Support key revocation.
- Use per-user LiteLLM virtual keys instead of shared keys.

### Abused Upstream Credential

Impact: runaway upstream bill or account compromise.

Controls:

- Keep static upstream credentials in env/secret manager.
- For registry-managed providers, encrypt API keys at rest with `PROVIDER_SECRET_KEY` and return only `apiKeyLast4`.
- Do not expose 9router publicly.
- Rotate `ROUTER_API_KEY` after suspected compromise.

### Runaway Token Usage

Impact: unexpected cost or provider rate limits.

Controls:

- Record tokens and estimated cost per request.
- Add monthly token and cost budget records.
- Next phase should enforce these limits at proxy request time.

### Malicious Internal User

Impact: intentional overuse, key sharing, or probing.

Controls:

- Personal LiteLLM virtual keys and usage attribution.
- Revocation endpoint.
- No raw prompt or completion storage by default.
- Admin token required for operational APIs.

### Provider Outage

Impact: developer tools fail or slow down.

Controls:

- Keep public model aliases stable.
- Route aliases through an upstream router capable of fallback.
- Document provider rotation and smoke tests.

### Misconfigured Model Alias

Impact: wrong model, higher cost, or unavailable route.

Controls:

- Keep bootstrap aliases in `litellm_config.yaml`.
- Manage dynamic aliases through `/admin/model-aliases` and sync to LiteLLM.
- Review `GET /admin/litellm/model-config` before changes.
- Smoke test `/v1/models` and one completion after changes.

## Provider Account Policy

Personal ChatGPT Pro/Gemini browser-session pooling is not production-supported. Upstream provider credentials must belong to authorized company/team/provider-approved accounts and must be supplied through environment variables, a deployment secret manager, or the encrypted provider registry. Full prompt/response logging remains off by default.
