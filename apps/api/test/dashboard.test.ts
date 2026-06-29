import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Env } from '../src/config/env.js';
import type { PrismaLike } from '../src/db/prisma.js';
import type {
  LiteLlmAdminClient,
  LiteLlmCreateVirtualKeyInput,
  LiteLlmSpendLogQuery,
  LiteLlmVirtualKey,
} from '../src/services/litellmAdminClient.js';

const env: Env = {
  NODE_ENV: 'test',
  PORT: 3000,
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  ADMIN_TOKEN: '1234567890123456',
  API_KEY_PEPPER: '1234567890123456',
  PROVIDER_SECRET_KEY: '12345678901234567890123456789012',
  LOG_LEVEL: 'silent',
  LITELLM_PROXY_URL: 'http://localhost:4000',
  LITELLM_MASTER_KEY: 'sk-1234567890123456',
  DEFAULT_KEY_BUDGET_DURATION: '30d',
  ROUTER_BASE_URL: 'http://router:20128/v1',
  ROUTER_API_KEY: 'router-key',
  ROUTER_PREMIUM_MODEL: 'openai/premium',
  ROUTER_BALANCED_MODEL: 'openai/balanced',
  ROUTER_FAST_MODEL: 'openai/fast',
  ROUTER_FALLBACK_MODEL: 'openai/fallback',
  ROUTER_AGENT_PREMIUM_MODEL: 'openai/agent-premium',
  ROUTER_AGENT_CHEAP_MODEL: 'openai/agent-cheap',
};

describe('dashboard route', () => {
  it('serves the dashboard shell while admin APIs remain protected', async () => {
    const app = await buildApp(env, {} as PrismaLike, new MockLiteLlmAdminClient());

    const dashboard = await app.inject({ method: 'GET', url: '/dashboard' });
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.headers['content-type']).toContain('text/html');
    expect(dashboard.body).toContain('team-llm-gateway');

    const admin = await app.inject({ method: 'GET', url: '/admin/users' });
    expect(admin.statusCode).toBe(401);

    await app.close();
  });
});

class MockLiteLlmAdminClient implements LiteLlmAdminClient {
  async ensureUser(_input: LiteLlmCreateVirtualKeyInput): Promise<void> {}
  async ensureTeam(_input: LiteLlmCreateVirtualKeyInput): Promise<void> {}
  async createVirtualKey(_input: LiteLlmCreateVirtualKeyInput): Promise<LiteLlmVirtualKey> {
    throw new Error('not used');
  }
  async revokeVirtualKey(_alias: string): Promise<void> {}
  async getSpendLogs(_query: LiteLlmSpendLogQuery): Promise<unknown[]> {
    return [];
  }
  async upsertModel(_payload: unknown): Promise<void> {}
}
