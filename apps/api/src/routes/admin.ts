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
