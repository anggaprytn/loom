import { describe, expect, it } from 'vitest';
import {
  buildLiteLlmModelPayload,
  renderLiteLlmModelConfig,
} from '../src/services/providerRegistry.js';

describe('provider registry', () => {
  it('builds LiteLLM dynamic model payloads without browser-session assumptions', () => {
    expect(
      buildLiteLlmModelPayload({
        alias: 'code-premium',
        providerSlug: 'company-ai',
        providerBaseUrl: 'https://ai.company.com/v1',
        providerAuthType: 'api_key',
        upstreamModel: 'openai/gemini-2.5-pro',
        apiKey: 'provider-key',
      }),
    ).toEqual({
      model_name: 'code-premium',
      litellm_params: {
        model: 'openai/gemini-2.5-pro',
        api_base: 'https://ai.company.com/v1',
        api_key: 'provider-key',
      },
      model_info: {
        source: 'team-llm-gateway',
        provider_slug: 'company-ai',
        description: undefined,
      },
    });
  });

  it('prefixes OpenAI-compatible upstream aliases for LiteLLM routing', () => {
    const payload = buildLiteLlmModelPayload({
      alias: 'code-premium',
      providerSlug: '9router',
      providerBaseUrl: 'https://router.example/v1',
      providerAuthType: 'api_key',
      upstreamModel: 'cx/gpt-5.3-codex-spark',
      apiKey: 'provider-key',
    });

    expect(payload.litellm_params.model).toBe('openai/cx/gpt-5.3-codex-spark');
  });

  it('renders redacted LiteLLM config for operator review', () => {
    const yaml = renderLiteLlmModelConfig([
      {
        alias: 'code-balanced',
        providerSlug: '9router',
        providerBaseUrl: 'http://9router:20128/v1',
        providerAuthType: 'api_key',
        upstreamModel: 'openai/gemini-2.5-flash',
        apiKey: '<redacted>',
      },
    ]);

    expect(yaml).toContain('model_name: code-balanced');
    expect(yaml).toContain('api_base: http://9router:20128/v1');
    expect(yaml).toContain('api_key: <redacted>');
    expect(yaml).not.toContain('provider-key');
  });
});
