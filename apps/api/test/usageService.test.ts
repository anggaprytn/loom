import { describe, expect, it } from 'vitest';
import { normalizeUsageRecord, summarizeUsage } from '../src/services/usageService.js';

describe('usage service', () => {
  it('normalizes total tokens', () => {
    const record = normalizeUsageRecord({
      timestamp: new Date('2026-06-29T00:00:00.000Z'),
      userId: 'user-1',
      model: 'codex-default',
      provider: '9router',
      promptTokens: 100,
      completionTokens: 25,
      estimatedCost: '0.001',
      status: 'success',
    });

    expect(record.totalTokens).toBe(125);
  });

  it('aggregates request, token, and cost totals', () => {
    const summary = summarizeUsage([
      {
        timestamp: new Date(),
        userId: 'user-1',
        model: 'codex-default',
        provider: '9router',
        promptTokens: 100,
        completionTokens: 25,
        estimatedCost: '0.001',
        status: 'success',
      },
      {
        timestamp: new Date(),
        userId: 'user-1',
        model: 'codex-default',
        provider: '9router',
        promptTokens: 50,
        completionTokens: 50,
        estimatedCost: '0.002',
        status: 'success',
      },
    ]);

    expect(summary).toEqual({
      requests: 2,
      promptTokens: 150,
      completionTokens: 75,
      totalTokens: 225,
      estimatedCost: '0.00300000',
    });
  });
});
