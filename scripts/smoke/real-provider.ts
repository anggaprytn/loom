import { adminFetch, liteLlmFetch, loadSmokeContext } from './client.js';

type ProviderResponse = {
  id: string;
  slug: string;
};

type AliasResponse = {
  id: string;
  alias: string;
};

type UserResponse = {
  id: string;
  team?: { id: string } | null;
};

type KeyResponse = {
  id: string;
  apiKey: string;
};

const ctx = loadSmokeContext();
const baseUrl = requiredEnv('REAL_PROVIDER_BASE_URL');
const apiKey = requiredEnv('REAL_PROVIDER_API_KEY');
const upstreamModel = requiredEnv('REAL_PROVIDER_MODEL');
const suffix = Date.now();
const alias = process.env.REAL_PROVIDER_ALIAS || `real-smoke-${suffix}`;

const provider = await adminFetch<ProviderResponse>(ctx, '/admin/providers', {
  method: 'POST',
  body: JSON.stringify({
    slug: `real-provider-${suffix}`,
    name: 'Real Provider Smoke',
    baseUrl,
    apiKey,
  }),
});

await adminFetch(ctx, `/admin/providers/${provider.id}/health`);

const modelAlias = await adminFetch<AliasResponse>(ctx, '/admin/model-aliases', {
  method: 'POST',
  body: JSON.stringify({
    alias,
    providerId: provider.id,
    upstreamModel,
    syncToLiteLlm: true,
  }),
});

const user = await adminFetch<UserResponse>(ctx, '/admin/users', {
  method: 'POST',
  body: JSON.stringify({
    email: `real-smoke-${suffix}@example.com`,
    name: 'Real Provider Smoke',
    team: { slug: `real-smoke-${suffix}`, name: 'Real Provider Smoke' },
  }),
});

const key = await adminFetch<KeyResponse>(ctx, '/admin/keys', {
  method: 'POST',
  body: JSON.stringify({
    userId: user.id,
    teamId: user.team?.id,
    name: 'real-provider-smoke',
    models: [alias],
  }),
});

await liteLlmFetch(ctx, '/v1/models', key.apiKey);
const completion = await liteLlmFetch(ctx, '/v1/chat/completions', key.apiKey, {
  method: 'POST',
  body: JSON.stringify({
    model: alias,
    messages: [{ role: 'user', content: 'Say ok' }],
  }),
});

console.log(
  JSON.stringify(
    {
      ok: true,
      providerId: provider.id,
      providerSlug: provider.slug,
      aliasId: modelAlias.id,
      alias: modelAlias.alias,
      userId: user.id,
      keyId: key.id,
      completion,
    },
    null,
    2,
  ),
);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}
