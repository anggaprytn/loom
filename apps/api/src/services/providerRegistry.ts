import type { ProviderAuthType } from '@prisma/client';

export type ProviderModelTarget = {
  alias: string;
  providerSlug: string;
  providerBaseUrl: string;
  providerAuthType: ProviderAuthType;
  upstreamModel: string;
  apiKey?: string | null;
  description?: string | null;
};

export function buildLiteLlmModelPayload(target: ProviderModelTarget) {
  return {
    model_name: target.alias,
    litellm_params: {
      model: normalizeLiteLlmOpenAiModel(target.upstreamModel),
      api_base: target.providerBaseUrl,
      ...(target.providerAuthType === 'api_key' ? { api_key: target.apiKey } : {}),
    },
    model_info: {
      source: 'team-llm-gateway',
      provider_slug: target.providerSlug,
      description: target.description ?? undefined,
    },
  };
}

function normalizeLiteLlmOpenAiModel(model: string) {
  if (/^(openai|azure|anthropic|gemini|vertex_ai|bedrock|cohere|mistral|xai)\//.test(model)) {
    return model;
  }

  return `openai/${model}`;
}

export function renderLiteLlmModelConfig(targets: ProviderModelTarget[]): string {
  const lines = ['model_list:'];

  for (const target of targets) {
    lines.push(`  - model_name: ${target.alias}`);
    lines.push('    litellm_params:');
    lines.push(`      model: ${normalizeLiteLlmOpenAiModel(target.upstreamModel)}`);
    lines.push(`      api_base: ${target.providerBaseUrl}`);
    if (target.providerAuthType === 'api_key') {
      lines.push('      api_key: <redacted>');
    }
    lines.push('    model_info:');
    lines.push('      source: team-llm-gateway');
    lines.push(`      provider_slug: ${target.providerSlug}`);
  }

  return `${lines.join('\n')}\n`;
}

export async function checkOpenAiCompatibleProvider(input: {
  baseUrl: string;
  apiKey?: string | null;
  timeoutMs?: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 5000);

  try {
    const response = await fetch(`${input.baseUrl.replace(/\/$/, '')}/models`, {
      headers: input.apiKey ? { Authorization: `Bearer ${input.apiKey}` } : undefined,
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    };
  } finally {
    clearTimeout(timeout);
  }
}
