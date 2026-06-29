import { describe, expect, it } from 'vitest';
import {
  aggregateLiteLlmUsage,
  normalizeLiteLlmSpendLog,
} from '../src/services/litellmUsageService.js';

describe('LiteLLM usage aggregation', () => {
  it('normalizes flexible spend log fields', () => {
    const record = normalizeLiteLlmSpendLog({
      startTime: '2026-06-30T00:00:00.000Z',
      user_id: 'user-1',
      team_id: 'team-1',
      key_alias: 'tlg_alias',
      token_id: 'token-1',
      model_group: 'code-premium',
      prompt_tokens: 100,
      completion_tokens: 25,
      total_tokens: 125,
      spend: 0.0125,
      status: 'success',
      response_time: 1.2,
    });

    expect(record).toMatchObject({
      userId: 'user-1',
      teamId: 'team-1',
      keyAlias: 'tlg_alias',
      keyId: 'token-1',
      model: 'code-premium',
      promptTokens: 100,
      completionTokens: 25,
      totalTokens: 125,
      estimatedCost: '0.01250000',
      status: 'success',
      latencyMs: 1200,
    });
  });

  it('normalizes LiteLLM database spend log attribution fields', () => {
    const record = normalizeLiteLlmSpendLog({
      startTime: '2026-06-30T00:00:00.000Z',
      user: 'user-from-column',
      team_id: 'team-from-column',
      api_key: 'hashed-token',
      model: 'openai/mock-premium',
      model_group: 'code-premium',
      prompt_tokens: 5,
      completion_tokens: 1,
      spend: 0,
      metadata: {
        user_api_key_alias: 'tlg_alias_from_metadata',
        user_api_key_user_id: 'user-from-metadata',
      },
      status: 'success',
    });

    expect(record).toMatchObject({
      userId: 'user-from-column',
      teamId: 'team-from-column',
      keyAlias: 'tlg_alias_from_metadata',
      keyId: 'hashed-token',
      model: 'code-premium',
      status: 'success',
    });
  });

  it('aggregates request, token, cost, error, and last usage totals', () => {
    const records = [
      normalizeLiteLlmSpendLog({
        timestamp: '2026-06-30T00:00:00.000Z',
        model: 'code-premium',
        prompt_tokens: 100,
        completion_tokens: 25,
        spend: 0.01,
        status: 'success',
      }),
      normalizeLiteLlmSpendLog({
        timestamp: '2026-06-30T01:00:00.000Z',
        model: 'code-premium',
        prompt_tokens: 50,
        completion_tokens: 10,
        spend: 0.02,
        status: 'error',
      }),
    ].filter((record) => record !== null);

    expect(aggregateLiteLlmUsage(records)).toMatchObject({
      requests: 2,
      errors: 1,
      promptTokens: 150,
      completionTokens: 35,
      totalTokens: 185,
      estimatedCost: '0.03000000',
      lastUsage: '2026-06-30T01:00:00.000Z',
    });
  });
});
