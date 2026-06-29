import { afterEach, describe, expect, it, vi } from 'vitest';
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
  LITELLM_PROXY_URL: 'http://litellm:4000/',
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

describe('admin chat test route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('proxies a chat smoke test through LiteLLM using the master key', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'code-premium',
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const app = await buildApp(env, {} as PrismaLike, new MockLiteLlmAdminClient());

    const response = await app.inject({
      method: 'POST',
      url: '/admin/chat-test',
      headers: { authorization: `Bearer ${env.ADMIN_TOKEN}` },
      payload: { model: 'code-premium', message: 'Say ok' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, model: 'code-premium', content: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://litellm:4000/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: `Bearer ${env.LITELLM_MASTER_KEY}` }),
      }),
    );

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
