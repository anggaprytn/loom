PRD: Loom

1. Product Name

Loom

Internal LLM gateway untuk developer tools seperti Codex CLI, Cursor, Cline, Continue, Roo, Claude Code, dan automation scripts.

2. Objective

Membangun satu endpoint AI internal yang bisa dipakai tim engineering dengan:
• API key per orang
• Usage tracking per user dan per team
• Budget dan rate limit
• Centralized audit
• Fallback antar provider
• Token saving untuk coding workflow
• Tidak membocorkan upstream OAuth token/API key ke user
• Tidak membuat user langsung akses 9router

3. Architecture Decision

Gunakan:
• LiteLLM sebagai frontend gateway
• Public/internal endpoint untuk user
• Virtual keys
• Budget
• Rate limit
• Usage tracking
• Admin dashboard
• Model aliasing
• 9Router sebagai backend router
• Provider session manager
• OAuth/API-key provider connector
• Fallback routing
• Token saving
• Coding-tool compatibility

Final Flow

Developer Tools
Codex CLI / Cursor / Cline / Continue / Roo
|
v
LiteLLM Proxy
per-user key, budget, audit, model alias
|
v
9Router
provider sessions, fallback, RTK/token saving
|
v
Upstream Providers
ChatGPT/Codex, Claude, Gemini, Copilot, OpenRouter, cheap/free fallback

4. Product Principle

Users only know LiteLLM.
Only the platform owner knows 9Router.
Only 9Router knows upstream provider credentials.

This keeps the system governable.

5. Problem

Current team AI usage usually fails in 5 ways: 1. Everyone uses their own random provider/API key. 2. No visibility into who uses what. 3. No per-user quota. 4. Rate limits kill coding sessions. 5. Admin cannot rotate or revoke access cleanly.

The proposed gateway solves that by separating:
• Access control: LiteLLM
• Provider routing: 9Router
• User tools: OpenAI-compatible endpoint

6. Target Users

Primary
• Backend engineers
• Mobile engineers
• Frontend engineers
• AI agent operators
• DevOps/platform maintainers

Secondary
• CTO/engineering manager
• Finance/admin reviewer
• Security reviewer

7. Goals

G1. One endpoint for all AI coding tools

All tools should point to:

https://ai.company.internal/v1

or local/VPN equivalent.

G2. One key per person

Each developer gets a LiteLLM virtual key:

sk-litellm-angga
sk-litellm-dev-01
sk-litellm-dev-02

No shared key by default.

G3. Per-user usage visibility

Admin can see:
• User
• Team
• Model alias
• Request count
• Token count
• Estimated cost
• Error rate
• Last usage
• Budget status

G4. 9Router remains private

9Router must not be publicly exposed.

Allowed:

LiteLLM -> 9Router

Blocked:

Developer -> 9Router
Internet -> 9Router

G5. Safe provider fallback

If premium subscription/provider hits limit, route to cheaper or free fallback provider.

Example route policy:

code-premium -> subscription model
code-balanced -> cheap paid provider
code-fallback -> free/low-cost provider

G6. Token and quota saving

9Router may apply coding-workflow optimizations such as token saving, fallback, quota tracking, and provider switching.

G7. Revocation in one place

When a user leaves or abuses quota, admin revokes their LiteLLM key only.

No upstream provider token rotation should be needed for normal user offboarding.

8. Non-Goals

This product is not intended to:
• Share one personal ChatGPT Pro account across a team
• Bypass provider usage limits
• Resell ChatGPT access
• Expose upstream OAuth tokens to users
• Replace official ChatGPT Business/Enterprise/API where compliance is required
• Store full prompts/responses by default
• Make 9Router public

9. Compliance Position

Default compliant mode:
• Each user gets a LiteLLM virtual key.
• Upstream providers must be company-owned, user-owned with explicit permission, or provider-approved for shared/team use.
• Personal ChatGPT Pro session must not be treated as a pooled company backend unless the provider terms allow it.
• For official team use, prefer:
• OpenAI API
• ChatGPT Business
• ChatGPT Enterprise
• Per-user subscriptions
• Provider accounts explicitly licensed for organization/team use

Gray-area lab mode:
• One owner tests ChatGPT subscription routing for personal workflow.
• Not exposed to the whole team.
• No production dependency.
• No SLA.

10. Core Product Requirements

R1. LiteLLM Proxy Endpoint

System must expose an OpenAI-compatible endpoint:

POST /v1/chat/completions
POST /v1/responses
GET /v1/models

The endpoint must require a LiteLLM virtual key.

R2. Per-User Virtual Keys

Admin must be able to create, rotate, disable, and inspect keys per user.

Each key must include metadata:

{
"user_id": "angga@company.com",
"team_id": "engineering",
"role": "developer",
"owner": "Angga"
}

R3. Team Budget

Each team can have:
• Daily request limit
• Monthly token budget
• Model access policy
• Premium model allowance
• Fallback model allowance

Example:

engineering:
code-premium: allowed
code-balanced: allowed
code-fallback: allowed

finance:
code-premium: blocked
code-balanced: allowed
code-fallback: allowed

R4. Model Aliases

Expose clean model names to users.

Recommended aliases:

code-premium
code-balanced
code-fast
code-fallback
agent-premium
agent-cheap

Do not expose raw upstream model/provider names unless needed.

R5. 9Router Private Backend

LiteLLM connects to 9Router using a single backend API key.

Example internal base URL:

http://9router:20128/v1

9Router dashboard must only be accessible by admin over:
• localhost
• VPN
• SSH tunnel
• private Docker network

R6. Direct ChatGPT Subscription Route

Optional direct LiteLLM ChatGPT subscription route may exist for admin/lab validation only.

It must not be the default team route unless legal/compliance approval exists.

R7. Logging Policy

Default logging should capture:
• Timestamp
• User key hash
• User ID
• Team ID
• Model alias
• Prompt token count
• Completion token count
• Total token count
• Latency
• Status code
• Error type

Default logging should not store:
• Full prompt
• Full response
• Secrets
• OAuth token
• API key
• File contents

Full body logging can be enabled only for short-lived debugging windows.

R8. Security Requirements
• LiteLLM must run behind TLS.
• Admin UI must not be public.
• 9Router must not be public.
• Upstream tokens must be encrypted or stored in restricted volume.
• Secrets must use env vars, Docker secrets, or Vault.
• Logs must redact Authorization, cookies, API keys, OAuth tokens.
• Per-user key rotation must be supported.
• Emergency kill switch must disable all premium routes.

R9. Failure Handling

If premium route fails: 1. Retry same provider once. 2. Fall back to secondary provider. 3. Fall back to cheap provider. 4. Fall back to free provider. 5. Return structured error if all fail.

Failure response must include:

{
"error": "all_routes_failed",
"route": "code-premium",
"fallback_attempted": true,
"request_id": "..."
}

R10. Admin Dashboard

Admin must be able to see:
• Active users
• Key status
• Usage by user
• Usage by team
• Model usage
• Error rates
• Budget remaining
• Upstream provider health
• Top users
• Abnormal spikes

11. Recommended Model Routing

code-premium

Use for:
• Codex-heavy work
• Refactoring
• Multi-file architecture
• Debugging complex code
• Agentic coding

Backend:

LiteLLM -> 9Router -> subscription/premium provider

code-balanced

Use for:
• Normal coding
• Small fixes
• Test generation
• Documentation

Backend:

LiteLLM -> 9Router -> cheap paid provider

code-fallback

Use for:
• Low-priority work
• When quota exhausted
• Emergency continuity

Backend:

LiteLLM -> 9Router -> free/low-cost provider

12. Reference LiteLLM Config

This is a reference shape, not final copy-paste production config.

model_list:

- model_name: code-premium
  litellm_params:
  model: openai/${ROUTER_PREMIUM_MODEL}
  api_base: http://9router:20128/v1
  api_key: os.environ/ROUTER_API_KEY

- model_name: code-balanced
  litellm_params:
  model: openai/${ROUTER_BALANCED_MODEL}
  api_base: http://9router:20128/v1
  api_key: os.environ/ROUTER_API_KEY

- model_name: code-fallback
  litellm_params:
  model: openai/${ROUTER_FALLBACK_MODEL}
  api_base: http://9router:20128/v1
  api_key: os.environ/ROUTER_API_KEY

# Optional lab-only direct ChatGPT subscription route.

# Do not expose to team unless licensing/compliance is approved.

- model_name: chatgpt-codex-lab
  model_info:
  mode: responses
  litellm_params:
  model: chatgpt/gpt-5.3-codex

general_settings:
master_key: os.environ/LITELLM_MASTER_KEY
database_url: os.environ/DATABASE_URL
always_include_stream_usage: true

13. Reference Environment

DATABASE_URL=postgresql://litellm:password@postgres:5432/litellm
LITELLM_MASTER_KEY=sk-change-this-master-key
ROUTER_API_KEY=router-internal-key

ROUTER_PREMIUM_MODEL=<model-id-from-9router>
ROUTER_BALANCED_MODEL=<model-id-from-9router>
ROUTER_FALLBACK_MODEL=<model-id-from-9router>

14. Deployment Topology

Docker Network: ai-gateway-net

Services:
postgres
litellm
9router
nginx/caddy

Public or VPN exposed:
nginx/caddy -> litellm

Private only:
postgres
9router
9router dashboard

15. User Onboarding Flow
    1.  Admin creates user in LiteLLM.
    2.  Admin creates LiteLLM virtual key.
    3.  Admin assigns allowed models.
    4.  Admin sets daily/monthly budget.
    5.  User configures tool:

Base URL: https://ai.company.internal/v1
API Key: sk-litellm-user-key
Model: code-premium

    6.	User never receives upstream provider credentials.
    7.	Usage appears under that user.

16. Codex CLI Usage Example

export OPENAI_BASE_URL="https://ai.company.internal/v1"
export OPENAI_API_KEY="sk-litellm-user-key"
export OPENAI_MODEL="code-premium"

17. Cursor or Cline Usage Example

Provider: OpenAI Compatible
Base URL: https://ai.company.internal/v1
API Key: sk-litellm-user-key
Model: code-premium

18. Admin Operations

Add User
• Create virtual key
• Attach user metadata
• Attach team metadata
• Assign model whitelist
• Assign budget

Rotate User Key
• Generate new key
• Notify user
• Revoke old key
• Confirm no traffic from old key

Disable User
• Revoke LiteLLM key
• Check no direct 9Router access
• Keep audit logs

Emergency Provider Shutdown
• Disable premium model alias
• Route traffic to fallback
• Notify users

19. Metrics

Product Metrics
• Percentage of AI calls attributed to a user: target 100%
• Percentage of tools using LiteLLM endpoint: target 100%
• Direct 9Router access by users: target 0%
• Mean setup friction per user: low
• Monthly premium quota exhaustion incidents: tracked
• Failed request rate: tracked

Engineering Metrics
• p95 gateway latency overhead
• 5xx rate
• fallback success rate
• streaming failure rate
• provider-specific error rate
• key revocation propagation time

Governance Metrics
• Unknown usage: 0
• Shared user keys: 0
• Public upstream secrets: 0
• Prompt/response full-body logs by default: 0

20. Acceptance Criteria

MVP is accepted when: 1. A developer can use Codex CLI through LiteLLM. 2. A developer can use Cursor/Cline through LiteLLM. 3. 9Router is not reachable directly from outside. 4. Each developer has a unique LiteLLM key. 5. Admin can see usage by key/user/team. 6. Admin can revoke one user without affecting others. 7. LiteLLM can route to 9Router as OpenAI-compatible backend. 8. At least three model aliases work:
• code-premium
• code-balanced
• code-fallback 9. Fallback route works when premium route fails. 10. No upstream OAuth/API token appears in logs.

21. Risks

R1. Account Sharing Risk

Using one personal ChatGPT Pro account as backend for many users is not safe from a policy/compliance standpoint.

Mitigation:
• Do not make pooled personal Pro session the production route.
• Use official API, Business, Enterprise, or per-user accounts.

R2. Subscription Route Instability

ChatGPT subscription routes may break due to browser/session/OAuth/edge-policy behavior.

Mitigation:
• Treat subscription routing as best-effort.
• Keep API-key providers as fallback.
• Keep 9Router fallback enabled.
• Do not promise SLA on personal subscription routes.

R3. Double Gateway Complexity

LiteLLM plus 9Router means two layers can mutate request/response behavior.

Risk areas:
• streaming
• tool calls
• Responses API
• Chat Completions bridge
• token usage accounting
• error mapping

Mitigation:
• Create compatibility test suite.
• Pin versions.
• Test Codex CLI, Cursor, Cline, Continue separately.

R4. Usage Accounting Mismatch

Subscription routes do not map cleanly to per-token billing.

Mitigation:
• Track tokens and internal budget separately.
• Do not treat subscription usage as exact provider bill.
• Use budget mainly as governance guardrail.

R5. Prompt Leakage

If request/response body logging is enabled carelessly, source code can leak into logs.

Mitigation:
• Disable full body logs by default.
• Store metadata only.
• Add redaction.
• Set retention policy.

22. Implementation Phases

Phase 0: Spike

Validate:
• LiteLLM can call 9Router via OpenAI-compatible route.
• Codex CLI works through LiteLLM.
• Cursor/Cline works through LiteLLM.
• Streaming works.
• Usage object appears.
• Fallback behavior works.

Phase 1: MVP

Deliver:
• Docker deployment
• Postgres
• LiteLLM virtual keys
• 9Router private backend
• Three model aliases
• Basic budget
• Admin-only dashboard
• Per-user onboarding doc

Phase 2: Governance

Deliver:
• Team budget
• Key rotation SOP
• Audit dashboard
• Alerting
• Provider health check
• Kill switch

Phase 3: Hardening

Deliver:
• SSO/VPN protection
• Secret rotation
• Redaction tests
• Load test
• Failure injection
• Full compatibility matrix

23. Recommended Final Decision

Use LiteLLM in front and 9Router behind.

Do not use 9Router directly as the team endpoint.

Do not make one personal ChatGPT Pro account the official shared backend.

Best production route:

Developer -> LiteLLM virtual key -> 9Router private backend -> authorized providers

This gives the team practical AI access without losing auditability, revocation, and control

buatkan pakai docker compose dan bisa deploy di coolify
