# Codex Usage

Each developer should receive a personal LiteLLM virtual key, usually `sk-...`, from the gateway admin. Do not share keys.

The control plane creates these keys through LiteLLM. They are accepted by LiteLLM at request time and can be revoked without rotating the upstream 9Router credential.

## OpenAI-Compatible Provider

Example Codex config:

```toml
model = "code-premium"

[providers.team_llm_gateway]
name = "team_llm_gateway"
base_url = "http://localhost:4000/v1"
api_key_env_var = "TEAM_LLM_GATEWAY_API_KEY"
wire_api = "chat"
```

Shell:

```bash
export TEAM_LLM_GATEWAY_API_KEY=sk_PERSONAL_LITELLM_KEY
```

## Model Aliases

- `code-premium`: premium coding route with fallback to balanced and fallback routes.
- `code-balanced`: balanced coding route with fallback to fallback route.
- `code-fast`: low-latency coding route.
- `code-fallback`: fallback coding route.
- `agent-premium`: premium agent route.
- `agent-cheap`: low-cost agent route.
- `codex-default` and `codex-premium`: backward-compatible aliases.

These aliases are stable front-door names. Operators can repoint them in `litellm_config.yaml` without changing developer configs.
