# Operations

## Start Locally

```bash
cp .env.example .env
npm install
npm run prisma:generate
docker compose up --build
```

## Rotate Admin Token

1. Generate a new long random token.
2. Update `ADMIN_TOKEN` in the deployment secret store or `.env`.
3. Restart the control-plane API.

## Rotate Upstream Provider Key

1. Replace `NINE_ROUTER_API_KEY` in the operator-managed environment.
2. Restart LiteLLM.
3. Run a small `/v1/models` or chat completion smoke test.

## Revoke a Team Key

```bash
curl -X POST http://localhost:3000/admin/keys/KEY_ID/revoke \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Data Retention

The MVP does not implement automated retention. For production, set a retention target for `UsageRecord` rows and export daily/monthly aggregate reports before pruning.

## Known MVP Boundary

Budget evaluation exists in service logic and a read endpoint, but proxy-time enforcement is not yet wired into LiteLLM. Until the next phase, use the control plane for issuance, revocation records, usage visibility, and operational reporting.
