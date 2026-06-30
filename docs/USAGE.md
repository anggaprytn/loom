# Usage

This guide assumes the Loom API is reachable at `http://localhost:3000`, LiteLLM is reachable at `http://localhost:4000`, and `ADMIN_TOKEN` is exported in your shell.

```bash
export ADMIN_TOKEN=replace-with-your-admin-token
```

## Health Check

```bash
curl http://localhost:3000/health
```

## Create a User

```bash
curl -s http://localhost:3000/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","name":"Dev Example","team":{"slug":"engineering","name":"Engineering"}}'
```

## Create a Personal LiteLLM Key

```bash
curl -s http://localhost:3000/admin/keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID_FROM_PREVIOUS_RESPONSE","name":"codex-cli"}'
```

The plaintext key is returned once. Store it in the user's local secret manager or shell environment. Loom stores only hashed local metadata and LiteLLM references.

## Revoke a Key

```bash
curl -s -X POST http://localhost:3000/admin/keys/KEY_ID/revoke \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Revocation calls LiteLLM and then marks the local metadata row revoked.

## Add a Provider

```bash
curl -s http://localhost:3000/admin/providers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"company-ai","name":"Company AI","baseUrl":"https://ai.example.com/v1","apiKey":"PROVIDER_API_KEY"}'
```

Provider API keys are encrypted at rest and list responses return only `apiKeyLast4`.

## Check Provider Health

```bash
curl -s http://localhost:3000/admin/providers/PROVIDER_ID/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Health checks call the provider's OpenAI-compatible `/v1/models` endpoint.

## Create a Model Alias

```bash
curl -s http://localhost:3000/admin/model-aliases \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"alias":"code-premium","providerId":"PROVIDER_ID","upstreamModel":"openai/provider-model-id"}'
```

Developers call the stable alias, not the provider URL.

## Call LiteLLM

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk_PERSONAL_LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"code-premium","messages":[{"role":"user","content":"Say ok"}]}'
```

## Usage Summaries

Default usage endpoints read LiteLLM spend logs:

```bash
curl -s http://localhost:3000/admin/usage \
  -H "Authorization: Bearer $ADMIN_TOKEN"

curl -s http://localhost:3000/admin/usage/by-user \
  -H "Authorization: Bearer $ADMIN_TOKEN"

curl -s http://localhost:3000/admin/usage/by-model \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

For manually ingested local usage records, add `?source=local`.

## Manual Usage Ingestion

```bash
curl -s http://localhost:3000/ingest/usage \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","keyId":"KEY_ID","model":"code-premium","provider":"company-ai","promptTokens":1000,"completionTokens":250,"estimatedCost":0.0125,"status":"success","latencyMs":1200}'
```

Manual ingestion does not store raw prompts or completions.

## Admin Dashboard

Open:

```text
http://localhost:3000/dashboard
```

The dashboard stores the admin token in browser local storage. Expose it only behind VPN, IP allowlist, or upstream authentication.
