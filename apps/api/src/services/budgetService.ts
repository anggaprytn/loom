import { Decimal } from 'decimal.js';

export type BudgetLimitInput = {
  monthlyTokenLimit?: number | null;
  monthlyCostLimit?: string | number | Decimal | null;
};

export type UsageTotals = {
  totalTokens: number;
  estimatedCost: string | number | Decimal;
};

export type BudgetDecision = {
  allowed: boolean;
  reasons: string[];
};

export function evaluateMonthlyBudget(
  budget: BudgetLimitInput | null | undefined,
  current: UsageTotals,
  incoming: UsageTotals = { totalTokens: 0, estimatedCost: 0 },
): BudgetDecision {
  if (!budget) {
    return { allowed: true, reasons: [] };
  }

  const reasons: string[] = [];
  const nextTokens = current.totalTokens + incoming.totalTokens;
  const nextCost = new Decimal(current.estimatedCost).plus(incoming.estimatedCost);

  if (budget.monthlyTokenLimit != null && nextTokens > budget.monthlyTokenLimit) {
    reasons.push('monthly token budget exceeded');
  }

  if (budget.monthlyCostLimit != null && nextCost.gt(new Decimal(budget.monthlyCostLimit))) {
    reasons.push('monthly cost budget exceeded');
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

export function monthWindow(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}
