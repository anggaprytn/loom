# Contributing

Thanks for your interest in improving Loom. This project sits on an access-control and credential boundary, so changes should be small, reviewable, and explicit about security impact.

## Development Setup

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run dev:api
npm run dev:web
```

Use Docker Compose when you need the full stack:

```bash
docker compose up --build
```

## Before Opening a Pull Request

Run the same checks used by CI:

```bash
npm run format:check
npm run lint
npm test
npm run build
```

For provider, key, or LiteLLM integration changes, also run the relevant smoke scripts against a local or test deployment.

## Contribution Guidelines

- Keep claims and documentation aligned with implemented behavior.
- Do not commit `.env`, provider keys, LiteLLM keys, database dumps, or logs containing credentials.
- Avoid logging prompts, completions, authorization headers, cookies, or provider secrets.
- Preserve the boundary that LiteLLM is the request-time gateway and Loom is the control plane.
- Add or update tests when changing API behavior, key lifecycle, provider registry logic, budget logic, or usage aggregation.
- Prefer small pull requests with a clear problem statement and verification notes.

## Reporting Security Issues

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md).
