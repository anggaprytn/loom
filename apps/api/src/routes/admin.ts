import { Prisma, UsageStatus } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Env } from '../config/env.js';
import type { PrismaLike } from '../db/prisma.js';
import { monthWindow } from '../services/budgetService.js';
import type { LiteLlmAdminClient } from '../services/litellmAdminClient.js';
import {
  aggregateLiteLlmUsage,
  groupLiteLlmUsage,
  normalizeLiteLlmSpendLog,
} from '../services/litellmUsageService.js';
import { normalizeAllowedModels } from '../services/modelPolicy.js';
import {
  buildLiteLlmModelPayload,
  checkOpenAiCompatibleProvider,
  renderLiteLlmModelConfig,
  type ProviderModelTarget,
} from '../services/providerRegistry.js';
import {
  decryptProviderSecret,
  encryptProviderSecret,
  secretLast4,
} from '../services/providerSecrets.js';
import { hashApiKey, keyPrefix } from '../utils/apiKey.js';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.string().min(1).default('developer'),
  team: z
    .object({
      slug: z.string().min(1),
      name: z.string().min(1),
    })
    .optional(),
});

const createKeySchema = z.object({
  userId: z.string().min(1),
  teamId: z.string().min(1).optional(),
  name: z.string().min(1).default('default'),
  models: z.array(z.string().min(1)).optional(),
  maxBudget: z.number().positive().optional(),
  budgetDuration: z.string().min(1).optional(),
  tpmLimit: z.number().int().positive().optional(),
  rpmLimit: z.number().int().positive().optional(),
});

const usageQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  source: z.enum(['litellm', 'local']).default('litellm'),
});

const createBudgetSchema = z.object({
  userId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
  monthlyTokenLimit: z.number().int().positive().optional(),
  monthlyCostLimit: z.number().positive().optional(),
});

const createProviderSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  authType: z.enum(['api_key', 'none']).default('api_key'),
  apiKey: z.string().min(1).optional(),
  enabled: z.boolean().default(true),
});

const updateProviderSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .optional(),
  name: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  authType: z.enum(['api_key', 'none']).optional(),
  apiKey: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  syncAliases: z.boolean().default(false),
});

const rotateProviderKeySchema = z.object({
  apiKey: z.string().min(1),
  syncAliases: z.boolean().default(true),
});

const createModelAliasSchema = z.object({
  alias: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  providerId: z.string().min(1),
  upstreamModel: z.string().min(1),
  description: z.string().min(1).optional(),
  enabled: z.boolean().default(true),
  syncToLiteLlm: z.boolean().default(true),
});

const updateModelAliasSchema = z.object({
  alias: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .optional(),
  providerId: z.string().min(1).optional(),
  upstreamModel: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  enabled: z.boolean().optional(),
  syncToLiteLlm: z.boolean().default(true),
});

export async function adminRoutes(
  app: FastifyInstance,
  prisma: PrismaLike,
  env: Env,
  litellmAdmin: LiteLlmAdminClient,
) {
  app.addHook('onRequest', app.verifyAdmin);

  app.post('/users', async (request, reply) => {
    const input = createUserSchema.parse(request.body);
    const team =
      input.team &&
      (await prisma.team.upsert({
        where: { slug: input.team.slug },
        update: { name: input.team.name },
        create: input.team,
      }));

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        teamId: team?.id,
      },
      include: { team: true },
    });

    return reply.code(201).send(user);
  });

  app.get('/users', async () =>
    prisma.user.findMany({
      include: { team: true },
      orderBy: { createdAt: 'desc' },
    }),
  );

  app.post('/keys', async (request, reply) => {
    const input = createKeySchema.parse(request.body);
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      include: { team: true },
    });

    if (!user) {
      return reply.code(404).send({ error: 'user_not_found' });
    }

    const teamId = input.teamId ?? user.teamId;
    const alias = `tlg_${randomUUID()}`;
    const virtualKeyInput = {
      alias,
      userId: user.id,
      teamId,
      ownerName: user.name,
      ownerEmail: user.email,
      role: user.role,
      models: normalizeAllowedModels(input.models),
      budget: {
        maxBudget: input.maxBudget ?? env.DEFAULT_KEY_MAX_BUDGET,
        budgetDuration: input.budgetDuration ?? env.DEFAULT_KEY_BUDGET_DURATION,
        tpmLimit: input.tpmLimit ?? env.DEFAULT_KEY_TPM_LIMIT,
        rpmLimit: input.rpmLimit ?? env.DEFAULT_KEY_RPM_LIMIT,
      },
    };

    await litellmAdmin.ensureUser(virtualKeyInput);
    await litellmAdmin.ensureTeam(virtualKeyInput);
    const virtualKey = await litellmAdmin.createVirtualKey(virtualKeyInput);
    const litellmKeyAlias = virtualKey.keyAlias ?? alias;

    let key;
    try {
      key = await prisma.apiKey.create({
        data: {
          prefix: keyPrefix(virtualKey.key),
          keyHash: hashApiKey(virtualKey.key, env.API_KEY_PEPPER),
          litellmKeyAlias,
          litellmKeyId: virtualKey.tokenId,
          name: input.name,
          userId: input.userId,
          teamId,
        },
        select: {
          id: true,
          prefix: true,
          litellmKeyAlias: true,
          litellmKeyId: true,
          name: true,
          status: true,
          userId: true,
          teamId: true,
          createdAt: true,
        },
      });
    } catch (error) {
      await litellmAdmin.revokeVirtualKey(litellmKeyAlias).catch((revokeError) => {
        app.log.error({ revokeError, litellmKeyAlias }, 'failed to clean up LiteLLM key');
      });
      throw error;
    }

    return reply.code(201).send({ ...key, apiKey: virtualKey.key });
  });

  app.get('/keys', async () =>
    prisma.apiKey.findMany({
      select: {
        id: true,
        prefix: true,
        litellmKeyAlias: true,
        litellmKeyId: true,
        name: true,
        status: true,
        userId: true,
        teamId: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  );

  app.post('/keys/:id/revoke', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const existing = await prisma.apiKey.findUnique({ where: { id: params.id } });

    if (!existing) {
      return reply.code(404).send({ error: 'key_not_found' });
    }

    if (existing.litellmKeyAlias) {
      await litellmAdmin.revokeVirtualKey(existing.litellmKeyAlias);
    }

    const key = await prisma.apiKey.update({
      where: { id: params.id },
      data: { status: 'revoked', revokedAt: new Date() },
      select: { id: true, status: true, revokedAt: true },
    });

    return reply.send(key);
  });

  app.get('/usage', async (request) => {
    const query = usageQuerySchema.parse(request.query);
    if (query.source === 'litellm') {
      const records = await getLiteLlmUsage(litellmAdmin, query);

      return {
        source: 'litellm',
        totals: aggregateLiteLlmUsage(records),
        byDay: dailyLiteLlmRollup(records),
        byUser: groupLiteLlmUsage(records, 'userId'),
        byTeam: groupLiteLlmUsage(records, 'teamId'),
        byModel: groupLiteLlmUsage(records, 'model'),
        byKey: groupLiteLlmUsage(records, 'keyAlias'),
      };
    }

    const where = usageWhere(query);
    const [grouped, dailyRecords] = await Promise.all([
      prisma.usageRecord.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: {
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          estimatedCost: true,
        },
      }),
      prisma.usageRecord.findMany({
        where,
        select: {
          timestamp: true,
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          estimatedCost: true,
        },
        orderBy: { timestamp: 'asc' },
      }),
    ]);

    return {
      source: 'local',
      totals: rollup(grouped),
      byDay: dailyRollup(dailyRecords),
      byStatus: grouped.map((row) => ({
        status: row.status,
        requests: row._count._all,
        promptTokens: row._sum.promptTokens ?? 0,
        completionTokens: row._sum.completionTokens ?? 0,
        totalTokens: row._sum.totalTokens ?? 0,
        estimatedCost: decimalToString(row._sum.estimatedCost),
      })),
    };
  });

  app.get('/usage/by-user', async (request) => {
    const query = usageQuerySchema.parse(request.query);
    if (query.source === 'litellm') {
      return groupLiteLlmUsage(await getLiteLlmUsage(litellmAdmin, query), 'userId');
    }

    const rows = await prisma.usageRecord.groupBy({
      by: ['userId'],
      where: usageWhere(query),
      _count: { _all: true },
      _sum: aggregateSums(),
    });

    return rows.map(formatAggregateRow('userId'));
  });

  app.get('/usage/by-model', async (request) => {
    const query = usageQuerySchema.parse(request.query);
    if (query.source === 'litellm') {
      return groupLiteLlmUsage(await getLiteLlmUsage(litellmAdmin, query), 'model');
    }

    const rows = await prisma.usageRecord.groupBy({
      by: ['model'],
      where: usageWhere(query),
      _count: { _all: true },
      _sum: aggregateSums(),
    });

    return rows.map(formatAggregateRow('model'));
  });

  app.post('/budgets', async (request, reply) => {
    const input = createBudgetSchema.parse(request.body);

    if (!input.userId && !input.teamId) {
      return reply.code(400).send({ error: 'userId or teamId is required' });
    }

    const budget = await prisma.budgetLimit.create({
      data: {
        userId: input.userId,
        teamId: input.teamId,
        monthlyTokenLimit: input.monthlyTokenLimit,
        monthlyCostLimit:
          input.monthlyCostLimit == null ? undefined : new Prisma.Decimal(input.monthlyCostLimit),
      },
    });

    return reply
      .code(201)
      .send({ ...budget, monthlyCostLimit: decimalToString(budget.monthlyCostLimit) });
  });

  app.get('/budgets', async () => {
    const budgets = await prisma.budgetLimit.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return budgets.map((budget) => ({
      ...budget,
      monthlyCostLimit: decimalToString(budget.monthlyCostLimit),
    }));
  });

  app.post('/providers', async (request, reply) => {
    const input = createProviderSchema.parse(request.body);

    if (input.authType === 'api_key' && !input.apiKey) {
      return reply.code(400).send({ error: 'apiKey is required for api_key providers' });
    }

    const provider = await prisma.provider.create({
      data: {
        slug: input.slug,
        name: input.name,
        baseUrl: input.baseUrl.replace(/\/$/, ''),
        authType: input.authType,
        encryptedApiKey: input.apiKey
          ? encryptProviderSecret(input.apiKey, env.PROVIDER_SECRET_KEY)
          : undefined,
        apiKeyLast4: input.apiKey ? secretLast4(input.apiKey) : undefined,
        enabled: input.enabled,
      },
      select: providerSelect(),
    });

    return reply.code(201).send(provider);
  });

  app.get('/providers', async () =>
    prisma.provider.findMany({
      select: providerSelect(),
      orderBy: { createdAt: 'desc' },
    }),
  );

  app.patch('/providers/:id', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updateProviderSchema.parse(request.body);
    const existing = await prisma.provider.findUnique({ where: { id: params.id } });

    if (!existing) {
      return reply.code(404).send({ error: 'provider_not_found' });
    }

    const nextAuthType = input.authType ?? existing.authType;
    if (nextAuthType === 'api_key' && !input.apiKey && !existing.encryptedApiKey) {
      return reply.code(400).send({ error: 'apiKey is required for api_key providers' });
    }

    const provider = await prisma.provider.update({
      where: { id: params.id },
      data: {
        slug: input.slug,
        name: input.name,
        baseUrl: input.baseUrl?.replace(/\/$/, ''),
        authType: input.authType,
        encryptedApiKey:
          input.authType === 'none'
            ? null
            : input.apiKey
              ? encryptProviderSecret(input.apiKey, env.PROVIDER_SECRET_KEY)
              : undefined,
        apiKeyLast4:
          input.authType === 'none' ? null : input.apiKey ? secretLast4(input.apiKey) : undefined,
        enabled: input.enabled,
      },
      select: providerSelect(),
    });

    if (input.syncAliases && provider.enabled) {
      await syncProviderAliases(prisma, litellmAdmin, provider.id, env.PROVIDER_SECRET_KEY);
    }

    return reply.send(provider);
  });

  app.post('/providers/:id/rotate-key', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = rotateProviderKeySchema.parse(request.body);
    const existing = await prisma.provider.findUnique({ where: { id: params.id } });

    if (!existing) {
      return reply.code(404).send({ error: 'provider_not_found' });
    }

    const provider = await prisma.provider.update({
      where: { id: params.id },
      data: {
        authType: 'api_key',
        encryptedApiKey: encryptProviderSecret(input.apiKey, env.PROVIDER_SECRET_KEY),
        apiKeyLast4: secretLast4(input.apiKey),
      },
      select: providerSelect(),
    });

    const syncedAliases =
      input.syncAliases && provider.enabled
        ? await syncProviderAliases(prisma, litellmAdmin, provider.id, env.PROVIDER_SECRET_KEY)
        : 0;

    return reply.send({ ...provider, rotated: true, syncedAliases });
  });

  app.delete('/providers/:id', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const existing = await prisma.provider.findUnique({ where: { id: params.id } });

    if (!existing) {
      return reply.code(404).send({ error: 'provider_not_found' });
    }

    await prisma.modelAlias.updateMany({
      where: { providerId: params.id },
      data: { enabled: false },
    });
    const provider = await prisma.provider.update({
      where: { id: params.id },
      data: { enabled: false },
      select: providerSelect(),
    });

    return reply.send({ ...provider, deleted: false, disabled: true });
  });

  app.get('/providers/:id/health', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const provider = await prisma.provider.findUnique({ where: { id: params.id } });

    if (!provider) {
      return reply.code(404).send({ error: 'provider_not_found' });
    }

    const apiKey = provider.encryptedApiKey
      ? decryptProviderSecret(provider.encryptedApiKey, env.PROVIDER_SECRET_KEY)
      : undefined;
    const health = await checkOpenAiCompatibleProvider({
      baseUrl: provider.baseUrl,
      apiKey,
    });
    const healthStatus = health.ok ? 'healthy' : 'unhealthy';

    await prisma.provider.update({
      where: { id: provider.id },
      data: { healthStatus, lastHealthAt: new Date() },
    });

    return reply
      .code(health.ok ? 200 : 502)
      .send({ providerId: provider.id, healthStatus, health });
  });

  app.post('/model-aliases', async (request, reply) => {
    const input = createModelAliasSchema.parse(request.body);
    const provider = await prisma.provider.findUnique({ where: { id: input.providerId } });

    if (!provider) {
      return reply.code(404).send({ error: 'provider_not_found' });
    }

    const alias = await prisma.modelAlias.create({
      data: {
        alias: input.alias,
        providerId: provider.id,
        upstreamModel: input.upstreamModel,
        description: input.description,
        enabled: input.enabled,
      },
      include: { provider: true },
    });

    if (input.syncToLiteLlm && alias.enabled && provider.enabled) {
      const target = aliasToTarget(alias, env.PROVIDER_SECRET_KEY);
      await litellmAdmin.upsertModel(buildLiteLlmModelPayload(target));
    }

    return reply.code(201).send(formatModelAlias(alias));
  });

  app.get('/model-aliases', async () => {
    const aliases = await prisma.modelAlias.findMany({
      include: { provider: true },
      orderBy: { createdAt: 'desc' },
    });

    return aliases.map(formatModelAlias);
  });

  app.patch('/model-aliases/:id', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = updateModelAliasSchema.parse(request.body);
    const existing = await prisma.modelAlias.findUnique({ where: { id: params.id } });

    if (!existing) {
      return reply.code(404).send({ error: 'model_alias_not_found' });
    }

    if (input.providerId) {
      const provider = await prisma.provider.findUnique({ where: { id: input.providerId } });
      if (!provider) {
        return reply.code(404).send({ error: 'provider_not_found' });
      }
    }

    const alias = await prisma.modelAlias.update({
      where: { id: params.id },
      data: {
        alias: input.alias,
        providerId: input.providerId,
        upstreamModel: input.upstreamModel,
        description: input.description,
        enabled: input.enabled,
      },
      include: { provider: true },
    });

    if (input.syncToLiteLlm && alias.enabled && alias.provider.enabled) {
      await syncAliasToLiteLlm(alias, litellmAdmin, env.PROVIDER_SECRET_KEY);
    }

    return reply.send(formatModelAlias(alias));
  });

  app.post('/model-aliases/:id/sync', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const alias = await prisma.modelAlias.findUnique({
      where: { id: params.id },
      include: { provider: true },
    });

    if (!alias) {
      return reply.code(404).send({ error: 'model_alias_not_found' });
    }

    if (!alias.enabled || !alias.provider.enabled) {
      return reply.code(400).send({ error: 'model_alias_or_provider_disabled' });
    }

    const target = aliasToTarget(alias, env.PROVIDER_SECRET_KEY);
    await litellmAdmin.upsertModel(buildLiteLlmModelPayload(target));

    return reply.send({ id: alias.id, alias: alias.alias, synced: true });
  });

  app.delete('/model-aliases/:id', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const existing = await prisma.modelAlias.findUnique({ where: { id: params.id } });

    if (!existing) {
      return reply.code(404).send({ error: 'model_alias_not_found' });
    }

    const alias = await prisma.modelAlias.update({
      where: { id: params.id },
      data: { enabled: false },
      include: { provider: true },
    });

    return reply.send({ ...formatModelAlias(alias), deleted: false, disabled: true });
  });

  app.get('/litellm/model-config', async () => {
    const aliases = await prisma.modelAlias.findMany({
      where: { enabled: true, provider: { enabled: true } },
      include: { provider: true },
      orderBy: { alias: 'asc' },
    });

    return {
      source: 'control-plane-db',
      yaml: renderLiteLlmModelConfig(
        aliases.map((alias) => ({
          alias: alias.alias,
          providerSlug: alias.provider.slug,
          providerBaseUrl: alias.provider.baseUrl,
          providerAuthType: alias.provider.authType,
          upstreamModel: alias.upstreamModel,
          apiKey: alias.provider.apiKeyLast4 ? '<redacted>' : null,
          description: alias.description,
        })),
      ),
    };
  });

  app.get('/budgets/check/:userId', async (request) => {
    const params = z.object({ userId: z.string().min(1) }).parse(request.params);
    const { start, end } = monthWindow();
    const budget = await prisma.budgetLimit.findFirst({
      where: { userId: params.userId, active: true },
      orderBy: { createdAt: 'desc' },
    });
    const usage = await prisma.usageRecord.aggregate({
      where: {
        userId: params.userId,
        timestamp: { gte: start, lt: end },
        status: UsageStatus.success,
      },
      _sum: { totalTokens: true, estimatedCost: true },
    });

    return {
      userId: params.userId,
      budget: budget && {
        ...budget,
        monthlyCostLimit: decimalToString(budget.monthlyCostLimit),
      },
      usage: {
        totalTokens: usage._sum.totalTokens ?? 0,
        estimatedCost: decimalToString(usage._sum.estimatedCost),
      },
    };
  });
}

function providerSelect() {
  return {
    id: true,
    slug: true,
    name: true,
    baseUrl: true,
    authType: true,
    apiKeyLast4: true,
    enabled: true,
    healthStatus: true,
    lastHealthAt: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

function aliasToTarget(
  alias: {
    alias: string;
    upstreamModel: string;
    description: string | null;
    provider: {
      slug: string;
      baseUrl: string;
      authType: 'api_key' | 'none';
      encryptedApiKey: string | null;
    };
  },
  providerSecretKey: string,
): ProviderModelTarget {
  return {
    alias: alias.alias,
    providerSlug: alias.provider.slug,
    providerBaseUrl: alias.provider.baseUrl,
    providerAuthType: alias.provider.authType,
    upstreamModel: alias.upstreamModel,
    apiKey: alias.provider.encryptedApiKey
      ? decryptProviderSecret(alias.provider.encryptedApiKey, providerSecretKey)
      : null,
    description: alias.description,
  };
}

async function syncProviderAliases(
  prisma: PrismaLike,
  litellmAdmin: LiteLlmAdminClient,
  providerId: string,
  providerSecretKey: string,
) {
  const aliases = await prisma.modelAlias.findMany({
    where: { providerId, enabled: true, provider: { enabled: true } },
    include: { provider: true },
  });

  for (const alias of aliases) {
    await syncAliasToLiteLlm(alias, litellmAdmin, providerSecretKey);
  }

  return aliases.length;
}

async function syncAliasToLiteLlm(
  alias: {
    alias: string;
    upstreamModel: string;
    description: string | null;
    provider: {
      slug: string;
      baseUrl: string;
      authType: 'api_key' | 'none';
      encryptedApiKey: string | null;
    };
  },
  litellmAdmin: LiteLlmAdminClient,
  providerSecretKey: string,
) {
  const target = aliasToTarget(alias, providerSecretKey);
  await litellmAdmin.upsertModel(buildLiteLlmModelPayload(target));
}

function formatModelAlias(alias: {
  id: string;
  alias: string;
  upstreamModel: string;
  enabled: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  provider: {
    id: string;
    slug: string;
    name: string;
    baseUrl: string;
    authType: 'api_key' | 'none';
    apiKeyLast4: string | null;
    enabled: boolean;
  };
}) {
  return {
    id: alias.id,
    alias: alias.alias,
    upstreamModel: alias.upstreamModel,
    enabled: alias.enabled,
    description: alias.description,
    createdAt: alias.createdAt,
    updatedAt: alias.updatedAt,
    provider: {
      id: alias.provider.id,
      slug: alias.provider.slug,
      name: alias.provider.name,
      baseUrl: alias.provider.baseUrl,
      authType: alias.provider.authType,
      apiKeyLast4: alias.provider.apiKeyLast4,
      enabled: alias.provider.enabled,
    },
  };
}

function usageWhere(query: { from?: string; to?: string }) {
  return {
    timestamp:
      query.from || query.to
        ? {
            gte: query.from ? new Date(query.from) : undefined,
            lt: query.to ? new Date(query.to) : undefined,
          }
        : undefined,
  };
}

function aggregateSums() {
  return {
    promptTokens: true,
    completionTokens: true,
    totalTokens: true,
    estimatedCost: true,
  } as const;
}

function formatAggregateRow(groupKey: 'userId' | 'model') {
  return (row: {
    [key: string]: unknown;
    _count: { _all: number };
    _sum: {
      promptTokens: number | null;
      completionTokens: number | null;
      totalTokens: number | null;
      estimatedCost: Prisma.Decimal | null;
    };
  }) => ({
    [groupKey]: row[groupKey],
    requests: row._count._all,
    promptTokens: row._sum.promptTokens ?? 0,
    completionTokens: row._sum.completionTokens ?? 0,
    totalTokens: row._sum.totalTokens ?? 0,
    estimatedCost: decimalToString(row._sum.estimatedCost),
  });
}

function rollup(
  rows: Array<{
    _count: { _all: number };
    _sum: {
      promptTokens: number | null;
      completionTokens: number | null;
      totalTokens: number | null;
      estimatedCost: Prisma.Decimal | null;
    };
  }>,
) {
  return rows.reduce(
    (acc, row) => ({
      requests: acc.requests + row._count._all,
      promptTokens: acc.promptTokens + (row._sum.promptTokens ?? 0),
      completionTokens: acc.completionTokens + (row._sum.completionTokens ?? 0),
      totalTokens: acc.totalTokens + (row._sum.totalTokens ?? 0),
      estimatedCost: new Prisma.Decimal(acc.estimatedCost)
        .plus(row._sum.estimatedCost ?? 0)
        .toFixed(8),
    }),
    {
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: '0.00000000',
    },
  );
}

function dailyRollup(
  rows: Array<{
    timestamp: Date;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: Prisma.Decimal;
  }>,
) {
  const buckets = new Map<
    string,
    {
      date: string;
      requests: number;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      estimatedCost: string;
    }
  >();

  for (const row of rows) {
    const date = row.timestamp.toISOString().slice(0, 10);
    const current = buckets.get(date) ?? {
      date,
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: '0.00000000',
    };

    buckets.set(date, {
      date,
      requests: current.requests + 1,
      promptTokens: current.promptTokens + row.promptTokens,
      completionTokens: current.completionTokens + row.completionTokens,
      totalTokens: current.totalTokens + row.totalTokens,
      estimatedCost: new Prisma.Decimal(current.estimatedCost).plus(row.estimatedCost).toFixed(8),
    });
  }

  return Array.from(buckets.values());
}

async function getLiteLlmUsage(
  litellmAdmin: LiteLlmAdminClient,
  query: { from?: string; to?: string },
) {
  const logs = await litellmAdmin.getSpendLogs(query);
  return logs.map(normalizeLiteLlmSpendLog).filter((record) => record !== null);
}

function dailyLiteLlmRollup(records: Awaited<ReturnType<typeof getLiteLlmUsage>>) {
  const buckets = new Map<string, typeof records>();

  for (const record of records) {
    const date = record.timestamp.toISOString().slice(0, 10);
    buckets.set(date, [...(buckets.get(date) ?? []), record]);
  }

  return [...buckets.entries()].map(([date, bucketRecords]) => ({
    date,
    ...aggregateLiteLlmUsage(bucketRecords),
  }));
}

function decimalToString(value: Prisma.Decimal | null | undefined): string {
  return value == null ? '0.00000000' : value.toFixed(8);
}
