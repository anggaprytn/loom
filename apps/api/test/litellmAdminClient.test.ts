import { describe, expect, it } from 'vitest';
import {
  buildLiteLlmKeyPayload,
  buildLiteLlmTeamPayload,
  buildLiteLlmUserPayload,
  type LiteLlmCreateVirtualKeyInput,
} from '../src/services/litellmAdminClient.js';

const input: LiteLlmCreateVirtualKeyInput = {
  alias: 'tlg_test',
  userId: 'user-1',
  teamId: 'team-1',
  ownerName: 'Dev Example',
  ownerEmail: 'dev@example.com',
  role: 'developer',
  models: ['code-premium', 'code-balanced', 'code-fallback'],
  budget: {
    maxBudget: 25,
    budgetDuration: '30d',
    tpmLimit: 10_000,
    rpmLimit: 120,
  },
};

describe('LiteLLM admin payloads', () => {
  it('builds virtual key payload with metadata, models, and budgets', () => {
    expect(buildLiteLlmKeyPayload(input)).toEqual({
      key_alias: 'tlg_test',
      user_id: 'user-1',
      team_id: 'team-1',
      models: ['code-premium', 'code-balanced', 'code-fallback'],
      metadata: {
        user_id: 'user-1',
        team_id: 'team-1',
        owner_name: 'Dev Example',
        owner_email: 'dev@example.com',
        role: 'developer',
        source: 'team-llm-gateway',
      },
      max_budget: 25,
      budget_duration: '30d',
      tpm_limit: 10_000,
      rpm_limit: 120,
    });
  });

  it('builds user and team mapping payloads without secrets', () => {
    expect(buildLiteLlmUserPayload(input)).toMatchObject({
      user_id: 'user-1',
      user_email: 'dev@example.com',
      user_alias: 'Dev Example',
      teams: ['team-1'],
    });
    expect(buildLiteLlmTeamPayload(input)).toMatchObject({
      team_id: 'team-1',
      models: ['code-premium', 'code-balanced', 'code-fallback'],
    });
  });
});
