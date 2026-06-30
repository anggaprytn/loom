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

Examples:

- `code-premium`: premium coding route.
- `code-balanced`: balanced coding route.
- `code-fast`: low-latency coding route.
- `code-fallback`: fallback coding route.
- `agent-premium`: premium agent route.
- `agent-cheap`: lower-cost agent route.

These aliases are stable front-door names only after an operator creates and syncs them. Operators can repoint aliases through the provider registry and `/admin/model-aliases` without changing developer configs. The upstream may be local 9Router, `ai.example.com`, OpenAI, Gemini through an OpenAI-compatible proxy, or a local model server. Codex still talks only to LiteLLM.
