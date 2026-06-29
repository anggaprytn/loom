import { Decimal } from 'decimal.js';

export type LiteLlmUsageRecord = {
  timestamp: Date;
  userId: string | null;
  teamId: string | null;
  keyAlias: string | null;
  keyId: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: string;
  status: 'success' | 'error';
  latencyMs: number | null;
};

export type LiteLlmUsageAggregate = {
  requests: number;
  errors: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: string;
  lastUsage: string | null;
  latencyMs: number | null;
};

export function normalizeLiteLlmSpendLog(value: unknown): LiteLlmUsageRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const timestamp = toDate(
    pick(value, ['startTime', 'start_time', 'created_at', 'timestamp', 'endTime', 'end_time']),
  );
  const promptTokens = toNumber(pick(value, ['prompt_tokens', 'promptTokens'])) ?? 0;
  const completionTokens = toNumber(pick(value, ['completion_tokens', 'completionTokens'])) ?? 0;
  const totalTokens =
    toNumber(pick(value, ['total_tokens', 'totalTokens'])) ?? promptTokens + completionTokens;
  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const statusValue = String(
    pick(value, ['status', 'request_status']) ?? pick(metadata, ['status']) ?? 'success',
  ).toLowerCase();
  const model = String(pick(value, ['model_group', 'modelGroup', 'model']) ?? 'unknown');
  const spend = toNumber(pick(value, ['spend', 'cost', 'estimated_cost', 'estimatedCost'])) ?? 0;

  return {
    timestamp: timestamp ?? new Date(),
    userId: toNullableString(
      pick(value, ['user_id', 'userId', 'user']) ?? pick(metadata, ['user_api_key_user_id']),
    ),
    teamId: toNullableString(
      pick(value, ['team_id', 'teamId']) ?? pick(metadata, ['user_api_key_team_id']),
    ),
    keyAlias: toNullableString(
      pick(value, ['key_alias', 'keyAlias', 'api_key_alias']) ??
        pick(metadata, ['user_api_key_alias']),
    ),
    keyId: toNullableString(
      pick(value, ['api_key', 'token', 'token_id', 'key_id', 'keyId']) ??
        pick(metadata, ['user_api_key']),
    ),
    model,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCost: new Decimal(spend).toFixed(8),
    status: statusValue.includes('error') || statusValue.includes('fail') ? 'error' : 'success',
    latencyMs:
      toNumber(pick(value, ['latency_ms', 'latencyMs', 'response_time_ms'])) ??
      secondsToMs(toNumber(pick(value, ['response_time', 'request_time']))),
  };
}

export function aggregateLiteLlmUsage(records: LiteLlmUsageRecord[]): LiteLlmUsageAggregate {
  return records.reduce<LiteLlmUsageAggregate>((summary, record) => {
    const latest =
      summary.lastUsage && new Date(summary.lastUsage) > record.timestamp
        ? summary.lastUsage
        : record.timestamp.toISOString();

    return {
      requests: summary.requests + 1,
      errors: summary.errors + (record.status === 'error' ? 1 : 0),
      promptTokens: summary.promptTokens + record.promptTokens,
      completionTokens: summary.completionTokens + record.completionTokens,
      totalTokens: summary.totalTokens + record.totalTokens,
      estimatedCost: new Decimal(summary.estimatedCost).plus(record.estimatedCost).toFixed(8),
      lastUsage: latest,
      latencyMs:
        summary.latencyMs == null
          ? record.latencyMs
          : record.latencyMs == null
            ? summary.latencyMs
            : Math.round((summary.latencyMs + record.latencyMs) / 2),
    };
  }, emptyAggregate());
}

export function groupLiteLlmUsage(records: LiteLlmUsageRecord[], key: keyof LiteLlmUsageRecord) {
  const buckets = new Map<string, LiteLlmUsageRecord[]>();
  for (const record of records) {
    const bucket = String(record[key] ?? 'unknown');
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), record]);
  }

  return [...buckets.entries()].map(([bucket, bucketRecords]) => ({
    [key]: bucket,
    ...aggregateLiteLlmUsage(bucketRecords),
  }));
}

export function emptyAggregate(): LiteLlmUsageAggregate {
  return {
    requests: 0,
    errors: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCost: '0.00000000',
    lastUsage: null,
    latencyMs: null,
  };
}

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] != null) {
      return record[key];
    }
  }

  return undefined;
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? null : date;
  }

  return null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function secondsToMs(value: number | null): number | null {
  return value == null ? null : Math.round(value * 1000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
