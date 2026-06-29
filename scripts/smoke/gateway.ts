import {
  adminFetch,
  expectRejected,
  liteLlmFetch,
  loadSmokeContext,
  maybeStartMockUpstream,
} from './client.js';

type UserResponse = {
  id: string;
  email: string;
  team?: { id: string } | null;
};

type KeyResponse = {
  id: string;
  apiKey: string;
  litellmKeyAlias?: string;
};

type UsageResponse = {
  totals?: { requests?: number };
  byUser?: Array<{ userId: string; requests: number }>;
  byTeam?: Array<{ teamId: string; requests: number }>;
  byModel?: Array<{ model: string; requests: number }>;
  byKey?: Array<{ keyAlias: string; requests: number }>;
};

const requiredModels = ['code-premium', 'code-balanced', 'code-fallback'];
const ctx = loadSmokeContext();
const mockServer = await maybeStartMockUpstream();

try {
  const suffix = Date.now();
  const user = await adminFetch<UserResponse>(ctx, '/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: `smoke-${suffix}@example.com`,
      name: 'Smoke Test',
      team: { slug: `smoke-${suffix}`, name: 'Smoke' },
    }),
  });

  const key = await adminFetch<KeyResponse>(ctx, '/admin/keys', {
    method: 'POST',
    body: JSON.stringify({
      userId: user.id,
      teamId: user.team?.id,
      name: 'smoke',
      models: ['code-premium', 'code-balanced', 'code-fallback'],
    }),
  });
  const otherUser = await adminFetch<UserResponse>(ctx, '/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: `smoke-other-${suffix}@example.com`,
      name: 'Smoke Other',
      team: { slug: `smoke-other-${suffix}`, name: 'Smoke Other' },
    }),
  });
  const otherKey = await adminFetch<KeyResponse>(ctx, '/admin/keys', {
    method: 'POST',
    body: JSON.stringify({
      userId: otherUser.id,
      teamId: otherUser.team?.id,
      name: 'smoke-other',
      models: ['code-premium', 'code-balanced', 'code-fallback'],
    }),
  });

  await liteLlmFetch(ctx, '/v1/models', key.apiKey);
  for (const model of requiredModels) {
    await liteLlmFetch(ctx, '/v1/chat/completions', key.apiKey, {
      method: 'POST',
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say ok' }],
      }),
    });
  }

  const usage = await waitForUsageAttribution(user, key);

  await adminFetch(ctx, `/admin/keys/${key.id}/revoke`, { method: 'POST' });
  await expectRejected(`${ctx.litellmUrl}/v1/models`, key.apiKey);
  await liteLlmFetch(ctx, '/v1/models', otherKey.apiKey);

  console.log(
    JSON.stringify(
      {
        ok: true,
        userId: user.id,
        keyId: key.id,
        litellmKeyAlias: key.litellmKeyAlias,
        otherUserStillWorks: true,
        usageRequests: usage.totals.requests,
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise<void>((resolve) =>
    mockServer ? mockServer.close(() => resolve()) : resolve(),
  );
}

async function waitForUsageAttribution(user: UserResponse, key: KeyResponse) {
  let lastUsage: UsageResponse | null = null;

  for (let attempt = 0; attempt < 15; attempt += 1) {
    const usage = await adminFetch<UsageResponse>(ctx, '/admin/usage?source=litellm');
    lastUsage = usage;

    const hasTotals = Number(usage.totals?.requests ?? 0) >= 1;
    const hasUser = usage.byUser?.some((row) => row.userId === user.id && row.requests > 0);
    const hasTeam =
      !user.team?.id ||
      usage.byTeam?.some((row) => row.teamId === user.team?.id && row.requests > 0);
    const hasModel = requiredModels.every((model) =>
      usage.byModel?.some((row) => row.model === model && row.requests > 0),
    );
    const hasKey =
      !key.litellmKeyAlias ||
      usage.byKey?.some((row) => row.keyAlias === key.litellmKeyAlias && row.requests > 0);

    if (hasTotals && hasUser && hasTeam && hasModel && hasKey) {
      return usage;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Expected LiteLLM usage attribution, last usage=${JSON.stringify(lastUsage)}`);
}
