# Security

## Hard Boundaries

This project must not implement credential scraping, quota bypassing, password sharing automation, or storage of user passwords. Upstream provider credentials must be operator-provided through environment variables and used only for authorized provider accounts.

## Threat Model

### Leaked Team Key

Impact: unauthorized usage attributed to a user or team.

Controls:

- Store only hashed API keys.
- Return plaintext key only once.
- Support key revocation.
- Use per-user keys instead of shared keys.

### Abused Upstream Credential

Impact: runaway upstream bill or account compromise.

Controls:

- Keep upstream credentials in env/secret manager only.
- Do not expose 9router publicly.
- Rotate `NINE_ROUTER_API_KEY` after suspected compromise.

### Runaway Token Usage

Impact: unexpected cost or provider rate limits.

Controls:

- Record tokens and estimated cost per request.
- Add monthly token and cost budget records.
- Next phase should enforce these limits at proxy request time.

### Malicious Internal User

Impact: intentional overuse, key sharing, or probing.

Controls:

- Personal keys and usage attribution.
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

- Keep aliases in `litellm_config.yaml`.
- Review changes before deploy.
- Smoke test `/v1/models` and one completion after changes.
