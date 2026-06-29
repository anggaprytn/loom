# team-llm-gateway

Internal LLM gateway for a small engineering team. LiteLLM is the OpenAI-compatible public proxy and request-time authority. 9router or another OpenAI-compatible provider is the private upstream. The control plane manages users, creates LiteLLM virtual keys, stores local metadata, and summarizes usage.

This repo intentionally does not scrape credentials, store user passwords, automate password sharing, or bypass provider quotas. Upstream credentials are operator-provided through environment variables only.

## Local Setup

```bash
cp .env.example .env
# edit ADMIN_TOKEN, API_KEY_PEPPER, LITELLM_*, and ROUTER_* values
npm install
npm run prisma:generate
docker compose up --build
```

Services:

- Control plane API: `http://localhost:${API_PORT:-3000}`
- LiteLLM proxy: `http://localhost:${LITELLM_PORT:-4000}`
- Postgres: private Compose network only
- Redis: private Compose network only

The control plane and LiteLLM use separate Postgres schemas: `app` and `litellm`. Keep them separate because LiteLLM manages its own Prisma schema.

Health check:

```bash
curl http://localhost:3000/health
```

## Admin Examples

Set your admin token:

```bash
export ADMIN_TOKEN=change-me-admin-token
```

Create a user:

```bash
curl -s http://localhost:3000/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","name":"Dev Example","team":{"slug":"engineering","name":"Engineering"}}'
```

Create a personal LiteLLM virtual key:

```bash
curl -s http://localhost:3000/admin/keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID_FROM_PREVIOUS_RESPONSE","name":"codex-cli"}'
```

The plaintext LiteLLM key is returned once, usually as `sk-...`. The control plane stores only a hash, prefix, LiteLLM key alias, and LiteLLM token id/reference metadata.

Insert a local/manual usage record:

```bash
curl -s http://localhost:3000/ingest/usage \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","keyId":"KEY_ID","model":"codex-default","provider":"9router","promptTokens":1000,"completionTokens":250,"estimatedCost":0.0125,"status":"success","latencyMs":1200}'
```

Inspect usage from LiteLLM spend logs:

```bash
curl -s http://localhost:3000/admin/usage -H "Authorization: Bearer $ADMIN_TOKEN"
curl -s http://localhost:3000/admin/usage/by-user -H "Authorization: Bearer $ADMIN_TOKEN"
curl -s http://localhost:3000/admin/usage/by-model -H "Authorization: Bearer $ADMIN_TOKEN"
```

For local/manual usage records, add `?source=local`.

Call LiteLLM with the returned virtual key:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk_PERSONAL_LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"code-premium","messages":[{"role":"user","content":"Say ok"}]}'
```

## Boundary

LiteLLM virtual keys are the real user keys. The control plane does not mint independent fake proxy keys. It calls LiteLLM admin APIs to create/revoke keys, then stores hashed local metadata for UX/reference. LiteLLM handles request-time auth, model allowlists, budgets supported by LiteLLM, and spend tracking.

## Codex Configuration

Point Codex or other OpenAI-compatible tooling at LiteLLM:

```toml
model = "code-premium"

[providers.team_llm_gateway]
name = "team_llm_gateway"
base_url = "http://localhost:4000/v1"
api_key_env_var = "TEAM_LLM_GATEWAY_API_KEY"
wire_api = "chat"
```

Then:

```bash
export TEAM_LLM_GATEWAY_API_KEY=sk_PERSONAL_LITELLM_KEY
```

See [docs/CODEX_USAGE.md](docs/CODEX_USAGE.md) for more examples.

## Smoke Test

With a real 9Router-compatible upstream configured:

```bash
npm run smoke:gateway
```

`ROUTER_*_MODEL` values should be LiteLLM model strings such as `openai/<9router-model-id>`. `ROUTER_BASE_URL` and `ROUTER_API_KEY` are preferred; Docker Compose maps legacy `NINE_ROUTER_BASE_URL` and `NINE_ROUTER_API_KEY` into those names if needed.

Mocked upstream mode requires LiteLLM to be started with `ROUTER_BASE_URL=http://host.docker.internal:5055/v1` and `ROUTER_*_MODEL` values such as `openai/mock-premium`, then:

```bash
SMOKE_MOCK_UPSTREAM=1 npm run smoke:gateway
```

## Development

```bash
npm test
npm run lint
npm run build
npm run format:check
```
