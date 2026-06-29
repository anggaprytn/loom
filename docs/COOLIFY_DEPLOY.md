# Coolify Deploy

## Target Exposure

- Public/VPN exposed by Coolify reverse proxy: LiteLLM internal port `4000`.
- Optional VPN/admin-only by Coolify reverse proxy: control-plane API and dashboard internal port `3000`.
- Private only: Postgres, Redis, 9Router, 9Router dashboard.

The Compose file uses `expose`, not host `ports`, so services do not bind host ports like `3000` or `4000`. Never expose the 9Router dashboard publicly.

## Required Environment

Control plane:

- `DATABASE_URL`
- `DIRECT_URL`
- `LITELLM_DATABASE_URL`
- `ADMIN_TOKEN`
- `API_KEY_PEPPER`
- `PROVIDER_SECRET_KEY`
- `LITELLM_PROXY_URL`
- `LITELLM_MASTER_KEY`
- `ROUTER_BASE_URL` or legacy `NINE_ROUTER_BASE_URL`
- `ROUTER_API_KEY` or legacy `NINE_ROUTER_API_KEY`
- `ROUTER_PREMIUM_MODEL`
- `ROUTER_BALANCED_MODEL`
- `ROUTER_FAST_MODEL`
- `ROUTER_FALLBACK_MODEL`
- `ROUTER_AGENT_PREMIUM_MODEL`
- `ROUTER_AGENT_CHEAP_MODEL`

Set model values as LiteLLM model strings, for example `openai/<9router-model-id>`, because the router is exposed to LiteLLM as an OpenAI-compatible backend.

`ROUTER_*` values are bootstrapping defaults. Phase 3 provider registry entries can add or repoint model aliases at runtime through the admin API and LiteLLM model APIs.

LiteLLM:

- `DATABASE_URL`
- `LITELLM_MASTER_KEY`
- `LITELLM_SALT_KEY`
- `ROUTER_BASE_URL`
- `ROUTER_API_KEY`
- all `ROUTER_*_MODEL` variables above

## Service Map

- `litellm`: reverse-proxied OpenAI-compatible endpoint.
- `api`: admin/control-plane API. Prefer VPN, IP allowlist, or upstream auth.
- `postgres`: persistent database volume. Keep private; no public host port is required.
- `redis`: optional cache/rate-limit support. Keep private; no public host port is required.

No service should publish host ports in production. Let Coolify route domains to container ports.

## Volumes

- Postgres data volume is required.
- App migrations create the `app` schema. LiteLLM manages its own database tables on startup.
- LiteLLM config is copied into a small derived image from `litellm_config.yaml`; no runtime file bind mount is required.

## Health Checks

- API: `GET /health`.
- LiteLLM: `GET /health` or `GET /v1/models` with a valid key.
- Postgres: `pg_isready`.
- Redis: `redis-cli ping`.

## Reverse Proxy Notes

Route developer traffic to LiteLLM only:

```text
https://llm.apps.anggaprytn.com/v1 -> litellm:4000/v1
https://llm-admin.apps.anggaprytn.com -> api:3000
```

Do not proxy 9Router publicly. If the admin API or `/dashboard` is exposed, put it behind VPN/auth and keep `ADMIN_TOKEN` long and rotated. Dynamic provider API keys stored through the admin API are encrypted with `PROVIDER_SECRET_KEY`, so keep that secret stable across restarts and backups.

## Production Notes

- Store secrets in Coolify environment/secrets, not in git.
- Rotate `ROUTER_API_KEY`, registry provider API keys, and `LITELLM_MASTER_KEY` after suspected compromise.
- Keep prompt/response logging disabled unless reviewed and approved.
- Run `npm run smoke:gateway` after deployment with a temporary user/key.
