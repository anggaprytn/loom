# Development

## Prerequisites

- Node.js 20 or newer
- npm
- Docker and Docker Compose for the full stack
- An OpenAI-compatible upstream provider for real gateway smoke tests

## Install

```bash
cp .env.example .env
npm install
npm run prisma:generate
```

Edit `.env` before running the API or Compose stack.

## Run Locally

API:

```bash
npm run dev:api
```

Web admin console:

```bash
npm run dev:web
```

Open `http://localhost:5173`. Vite proxies `/admin/*` calls to `http://localhost:3000`.

Full stack:

```bash
docker compose up --build
```

The default Compose file exposes service ports only inside the Compose network. Add a local override if you need direct host ports.

## Checks

```bash
npm run format:check
npm run lint
npm test
npm run build
```

The root `lint` script runs TypeScript checks for both workspaces. The root `test` script runs the API Vitest suite.

## Database

Prisma schema:

```text
prisma/schema.prisma
```

Generate client:

```bash
npm run prisma:generate
```

Create a development migration:

```bash
npm run prisma:migrate
```

Docker startup runs `prisma migrate deploy` before starting the API.

## Smoke Scripts

Gateway smoke:

```bash
npm run smoke:gateway
```

Mock upstream mode requires LiteLLM to be started with `ROUTER_BASE_URL=http://host.docker.internal:5055/v1` and mock model values such as `openai/mock-premium`, then:

```bash
SMOKE_MOCK_UPSTREAM=1 npm run smoke:gateway
```

Real provider registry smoke:

```bash
REAL_PROVIDER_BASE_URL=https://ai.example.com/v1 \
REAL_PROVIDER_API_KEY=provider-key \
REAL_PROVIDER_MODEL=openai/provider-model-id \
npm run smoke:real-provider
```

The real-provider script creates a temporary provider, alias, user, LiteLLM virtual key, and sends one chat completion through LiteLLM.

## Implementation Notes

- Admin routes live in `apps/api/src/routes/admin.ts`.
- Dashboard fallback HTML is in `apps/api/src/routes/dashboard.ts`.
- React dashboard source is in `apps/web/src`.
- Provider alias rendering and health checks live in `apps/api/src/services/providerRegistry.ts`.
- LiteLLM admin integration lives in `apps/api/src/services/litellmAdminClient.ts`.
- Usage aggregation lives in `apps/api/src/services/litellmUsageService.ts` and `apps/api/src/services/usageService.ts`.
