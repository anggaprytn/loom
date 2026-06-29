import { describe, expect, it } from 'vitest';
import { evaluateMonthlyBudget, monthWindow } from '../src/services/budgetService.js';

describe('budget service', () => {
  it('allows usage inside token and cost budgets', () => {
    const decision = evaluateMonthlyBudget(
      { monthlyTokenLimit: 1000, monthlyCostLimit: '1.00' },
      { totalTokens: 200, estimatedCost: '0.10' },
      { totalTokens: 300, estimatedCost: '0.20' },
    );

    expect(decision.allowed).toBe(true);
    expect(decision.reasons).toEqual([]);
  });

  it('blocks usage over monthly budgets', () => {
    const decision = evaluateMonthlyBudget(
      { monthlyTokenLimit: 1000, monthlyCostLimit: '1.00' },
      { totalTokens: 900, estimatedCost: '0.90' },
      { totalTokens: 200, estimatedCost: '0.20' },
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain('monthly token budget exceeded');
    expect(decision.reasons).toContain('monthly cost budget exceeded');
  });

  it('creates UTC month windows', () => {
    const window = monthWindow(new Date('2026-06-29T12:00:00.000Z'));

    expect(window.start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(window.end.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });
});
