import { Decimal } from 'decimal.js';

export type UsageRecordInput = {
  timestamp: Date;
  userId: string;
  keyId?: string | null;
  teamId?: string | null;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  estimatedCost: string | number | Decimal;
  status: string;
  latencyMs?: number | null;
};

export type UsageSummary = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: string;
};

export function normalizeUsageRecord(
  input: UsageRecordInput,
): UsageRecordInput & { totalTokens: number } {
  const totalTokens = input.totalTokens ?? input.promptTokens + input.completionTokens;

  if (totalTokens !== input.promptTokens + input.completionTokens) {
    throw new Error('totalTokens must equal promptTokens + completionTokens');
  }

  if (input.promptTokens < 0 || input.completionTokens < 0 || totalTokens < 0) {
    throw new Error('token counts must be non-negative');
  }

  return { ...input, totalTokens };
}

export function summarizeUsage(records: UsageRecordInput[]): UsageSummary {
  return records.reduce<UsageSummary>(
    (summary, record) => {
      summary.requests += 1;
      summary.promptTokens += record.promptTokens;
      summary.completionTokens += record.completionTokens;
      summary.totalTokens += record.totalTokens ?? record.promptTokens + record.completionTokens;
      summary.estimatedCost = new Decimal(summary.estimatedCost)
        .plus(record.estimatedCost)
        .toFixed(8);
      return summary;
    },
    {
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: '0.00000000',
    },
  );
}
