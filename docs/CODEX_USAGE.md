# Codex Usage

Each developer should receive a personal `tlg_live_...` key from the gateway admin. Do not share keys.

MVP boundary: these keys are managed by the control plane today. LiteLLM request-time validation against them is the next integration phase. Until that is wired, use the LiteLLM master key only for local upstream smoke tests.

## OpenAI-Compatible Provider

Example Codex config:

```toml
model = "codex-default"

[providers.team_llm_gateway]
name = "team_llm_gateway"
base_url = "http://localhost:4000/v1"
api_key_env_var = "TEAM_LLM_GATEWAY_API_KEY"
wire_api = "chat"
```

Shell:

```bash
export TEAM_LLM_GATEWAY_API_KEY=tlg_live_PERSONAL_KEY
```

## Model Aliases

- `codex-default`: default coding route.
- `codex-premium`: higher capability route.
- `gpt-5.5`: general route.
- `gpt-5.5-thinking`: reasoning route.

These aliases are stable front-door names. Operators can repoint them in `litellm_config.yaml` without changing developer configs.
