# team-llm-gateway

Internal LLM gateway MVP for a small engineering team. LiteLLM is the OpenAI-compatible public proxy, 9router or another OpenAI-compatible provider is the private upstream, and this control plane manages users, personal keys, usage records, and budgets.

This repo intentionally does not scrape credentials, store user passwords, automate password sharing, or bypass provider quotas. Upstream credentials are operator-provided through environment variables only.

## Local Setup

```bash
cp .env.example .env
# edit ADMIN_TOKEN, API_KEY_PEPPER, LITELLM_* and NINE_ROUTER_* values
npm install
npm run prisma:generate
docker compose up --build
```

Services:

- Control plane API: `http://localhost:3000`
- LiteLLM proxy: `http://localhost:4000`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

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

Create a personal API key:

```bash
curl -s http://localhost:3000/admin/keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID_FROM_PREVIOUS_RESPONSE","name":"codex-cli"}'
```

The plaintext key is returned once as `tlg_live_...`. The database stores only `keyHash` and `prefix`.

Insert a usage record:

```bash
curl -s http://localhost:3000/ingest/usage \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","keyId":"KEY_ID","model":"codex-default","provider":"9router","promptTokens":1000,"completionTokens":250,"estimatedCost":0.0125,"status":"success","latencyMs":1200}'
```

Inspect usage:

```bash
curl -s http://localhost:3000/admin/usage -H "Authorization: Bearer $ADMIN_TOKEN"
curl -s http://localhost:3000/admin/usage/by-user -H "Authorization: Bearer $ADMIN_TOKEN"
curl -s http://localhost:3000/admin/usage/by-model -H "Authorization: Bearer $ADMIN_TOKEN"
```

Call LiteLLM after proxy-key enforcement is wired:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer tlg_live_PERSONAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"codex-default","messages":[{"role":"user","content":"Say hello"}]}'
```

For this MVP's raw LiteLLM upstream smoke test, use `LITELLM_MASTER_KEY` from `.env`. Personal `tlg_live_...` keys are created, hashed, revoked, and reported by the control plane now; request-time LiteLLM validation against those keys is the next phase.

## Boundary

The MVP control plane creates keys, stores hashed keys, records usage, aggregates usage, and contains budget-checking logic. LiteLLM proxy enforcement against these control-plane keys is the next phase: wire LiteLLM virtual key creation callbacks or a small auth middleware/plugin so every proxy request checks key status and budget before forwarding.

## Codex Configuration

Point Codex or other OpenAI-compatible tooling at LiteLLM:

```toml
model = "codex-default"

[providers.team_llm_gateway]
name = "team_llm_gateway"
base_url = "http://localhost:4000/v1"
api_key_env_var = "TEAM_LLM_GATEWAY_API_KEY"
wire_api = "chat"
```

Then:

```bash
export TEAM_LLM_GATEWAY_API_KEY=tlg_live_PERSONAL_KEY
```

See [docs/CODEX_USAGE.md](docs/CODEX_USAGE.md) for more examples.

## Development

```bash
npm test
npm run lint
npm run build
npm run format:check
```
