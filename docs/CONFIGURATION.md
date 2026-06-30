# Configuration

Loom is configured with environment variables. Copy `.env.example` to `.env` for local work, then replace every placeholder secret before running a shared or production deployment.

```bash
cp .env.example .env
```

## Required Control-Plane Variables

| Variable              | Purpose                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`            | `development`, `test`, or `production`. Defaults to `development`.                                                |
| `PORT`                | Fastify API port. Defaults to `3000`.                                                                             |
| `DATABASE_URL`        | Prisma URL for the Loom `app` schema.                                                                             |
| `DIRECT_URL`          | Direct Prisma URL for migrations. Usually matches `DATABASE_URL`.                                                 |
| `ADMIN_TOKEN`         | Bearer token required for `/admin/*` and `/ingest/*`. Minimum 16 characters.                                      |
| `API_KEY_PEPPER`      | Secret pepper used when hashing returned LiteLLM keys locally. Minimum 16 characters.                             |
| `PROVIDER_SECRET_KEY` | Secret used to encrypt provider API keys at rest. Minimum 32 characters. Keep stable across restarts and backups. |
| `LITELLM_PROXY_URL`   | Internal URL for the LiteLLM proxy, for example `http://litellm:4000`.                                            |
| `LITELLM_MASTER_KEY`  | LiteLLM admin key. Must start with `sk-`.                                                                         |

## LiteLLM Variables

| Variable               | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `LITELLM_DATABASE_URL` | Postgres URL for the separate LiteLLM schema.              |
| `LITELLM_MASTER_KEY`   | Admin key used by LiteLLM and Loom's LiteLLM admin client. |
| `LITELLM_SALT_KEY`     | LiteLLM salt key. Use a long random value.                 |

## Static Upstream Bootstrap

The provider registry can add and rotate OpenAI-compatible upstreams at runtime. These variables remain useful for first boot, static fallback, and disaster recovery.

| Variable                     | Purpose                                            |
| ---------------------------- | -------------------------------------------------- |
| `ROUTER_BASE_URL`            | OpenAI-compatible upstream base URL.               |
| `ROUTER_API_KEY`             | Upstream API key.                                  |
| `ROUTER_PREMIUM_MODEL`       | LiteLLM model string for premium routing.          |
| `ROUTER_BALANCED_MODEL`      | LiteLLM model string for balanced routing.         |
| `ROUTER_FAST_MODEL`          | LiteLLM model string for fast routing.             |
| `ROUTER_FALLBACK_MODEL`      | LiteLLM model string for fallback routing.         |
| `ROUTER_AGENT_PREMIUM_MODEL` | LiteLLM model string for premium agent routing.    |
| `ROUTER_AGENT_CHEAP_MODEL`   | LiteLLM model string for lower-cost agent routing. |

Legacy `NINE_ROUTER_BASE_URL` and `NINE_ROUTER_API_KEY` are still accepted if the corresponding `ROUTER_*` variable is not set.

## Optional Defaults for Created Keys

| Variable                      | Purpose                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| `DEFAULT_KEY_MAX_BUDGET`      | Default LiteLLM max budget for newly created virtual keys. |
| `DEFAULT_KEY_BUDGET_DURATION` | Default LiteLLM budget window. Defaults to `30d`.          |
| `DEFAULT_KEY_TPM_LIMIT`       | Default tokens-per-minute limit for newly created keys.    |
| `DEFAULT_KEY_RPM_LIMIT`       | Default requests-per-minute limit for newly created keys.  |

## Optional Service Variables

| Variable                    | Purpose                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `REDIS_URL`                 | Redis URL. Redis is included for future rate-limit/cache support. |
| `SERVICE_FQDN_ADMIN_3000`   | Bare hostname for reverse-proxy mapping to the API/admin service. |
| `SERVICE_FQDN_GATEWAY_4000` | Bare hostname for reverse-proxy mapping to LiteLLM.               |

## Secret Handling

- Do not commit `.env`.
- Use a deployment secret manager for production.
- Rotate provider API keys, `LITELLM_MASTER_KEY`, and affected LiteLLM virtual keys after suspected compromise.
- If `PROVIDER_SECRET_KEY` changes, existing encrypted provider API keys cannot be decrypted.
