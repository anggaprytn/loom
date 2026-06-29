# Operations

## Start Locally

```bash
cp .env.example .env
npm install
npm run prisma:generate
docker compose up --build
```

Postgres initializes separate schemas: `app` for the control plane and `litellm` for LiteLLM. Do not point both services at the same schema; LiteLLM manages its own Prisma schema and can otherwise modify unrelated tables.

## Rotate Admin Token

1. Generate a new long random token.
2. Update `ADMIN_TOKEN` in the deployment secret store or `.env`.
3. Restart the control-plane API.

## Rotate Upstream Provider Key

For static env providers:

1. Replace `ROUTER_API_KEY` in the operator-managed environment.
2. Restart LiteLLM.
3. Run a small `/v1/models` or chat completion smoke test.

For registry-managed providers, create a replacement provider entry or update through a future edit endpoint, then resync affected aliases with `POST /admin/model-aliases/:id/sync`. The MVP intentionally avoids returning stored provider API keys.

## Add Provider and Alias

Use the provider registry for OpenAI-compatible targets such as local 9Router, `https://ai.company.com/v1`, OpenAI, or an internal vLLM/Ollama proxy:

```bash
curl -s http://localhost:3000/admin/providers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"9router","name":"9Router Local","baseUrl":"http://9router:20128/v1","apiKey":"LOCAL_TOKEN"}'
```

Check provider health:

```bash
curl -s http://localhost:3000/admin/providers/PROVIDER_ID/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Create a public alias and sync it to LiteLLM:

```bash
curl -s http://localhost:3000/admin/model-aliases \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"alias":"code-premium","providerId":"PROVIDER_ID","upstreamModel":"openai/gemini-2.5-pro"}'
```

Developers keep using `code-premium` regardless of whether it points to 9Router, `ai.company.com`, or another OpenAI-compatible backend.

## Revoke a Team Key

```bash
curl -X POST http://localhost:3000/admin/keys/KEY_ID/revoke \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Revocation calls LiteLLM `/key/delete` using the stored LiteLLM key alias, then marks the local metadata row revoked.

## Usage Source

Default admin usage endpoints read LiteLLM spend logs:

```bash
curl http://localhost:3000/admin/usage -H "Authorization: Bearer $ADMIN_TOKEN"
```

Use `?source=local` only for manually ingested records or future log forwarder debugging.

## Data Retention

The MVP does not implement automated retention. For production, set a retention target for `UsageRecord` rows and export daily/monthly aggregate reports before pruning.

## Fallback Test Path

To prove LiteLLM fallback behavior, point `ROUTER_PREMIUM_MODEL` at a known-broken model id, keep `ROUTER_BALANCED_MODEL` and `ROUTER_FALLBACK_MODEL` valid, restart LiteLLM, then call `code-premium`. The request should fall back according to `litellm_config.yaml`. If all routes fail, LiteLLM returns a structured provider/proxy error.
