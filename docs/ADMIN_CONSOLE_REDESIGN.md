# Admin Console Redesign Plan

This plan targets the current React admin dashboard in `apps/web/src/App.tsx` and
`apps/web/src/styles.css`. The goal is to move the UI from a generic internal
tool to a premium operational console: fast, calm, trustworthy, dense, and clear
under pressure.

## Executive Priority

The highest-impact change is not visual decoration. It is operational clarity:
operators must know what data is current, what data failed, what action is safe,
what action is destructive, what changed after a click, and how to recover.

Implement in this order:

1. Simplify the topbar and action language.
2. Add section and object-level loading, stale, failure, and retry states.
3. Move destructive and rare actions into separated action menus.
4. Redesign Users & Keys as a guided developer-key issuance flow.
5. Tighten table hierarchy, status labels, and visual system rules.
6. Add subtle motion only where it improves confidence.

## Safe Improvements

These are low-risk UI and state changes that should be done first.

### Topbar

Current issue: the topbar shows `Admin session`, token input, `Unlock`, `Clear`,
and `Refresh` with overlapping meanings.

Target structure:

- Page title and description on the left.
- Session/data status and one primary load action on the right.
- Low-frequency session utilities in a quiet menu or Settings panel.

Exact copy:

| Current | Replace with | Reason |
| --- | --- | --- |
| `Locked` | `Token required` | States the missing requirement. |
| `Admin session` | `Token loaded` | Avoids implying a known user identity. |
| `Unlock` | `Load dashboard` | Names the actual operation. |
| `Refresh` | `Reload dashboard` | Use only after data has loaded. |
| `Clear` | `Clear token` | Names what will be cleared. |
| `Refreshing` | `Loading dashboard` | Matches the primary action. |
| `Enter the admin token before refreshing.` | `Enter the admin token before loading dashboard data.` | Avoids refresh-only framing. |

Behavior requirements:

- Before first load, the primary button label is `Load dashboard`.
- After a successful load, the same button becomes `Reload dashboard`.
- `Clear token` must not sit beside the primary action as an equal-weight
  button. Place it in Settings or a compact `Session` utility menu.
- The status badge should show one of: `Token required`, `Token loaded`,
  `Loading dashboard`, `Current`, `Stale`, `Some data failed`.

### Action Copy

Every action label must name the operational effect.

| Current | Replace with |
| --- | --- |
| `Health` | `Check health` |
| `Sync` | `Sync alias` |
| `Apply` | `Refresh usage` |
| `Create Key` | `Issue developer key` |
| `Issue Personal Key` | `Issue developer key` |
| `Create + Sync` | `Create and sync alias` |
| `Copy Codex Env` | `Copy Codex config` |
| `Details` | `View details` |
| `Action completed.` | Exact result, such as `Provider disabled.` |
| `Partial data failure` | `Some dashboard data failed to load.` |
| `No provider` | `No providers configured` |
| `Needs check` | `Unchecked` |
| `No operator activity in this browser session yet.` | `No actions recorded in this browser session.` |

Use `developer key` as the primary UI term. Explain once in helper text:

> Developer keys are LiteLLM virtual keys issued for individual developers.

### Empty States

Empty states must tell the operator the next direct action.

| Surface | Target copy |
| --- | --- |
| Keys table | `No developer keys yet. Select a developer and issue the first key.` |
| Providers table | `No providers configured. Add a provider before creating aliases.` |
| Aliases table | `No model aliases configured. Create an alias before issuing developer keys.` |
| Usage tables | `No usage found for this source and date range. Adjust filters or check LiteLLM spend logs.` |
| Activity panel | `No actions recorded in this browser session.` |

### Toasts

Toast copy must name the exact action and object. Do not use generic success
messages.

Examples:

- `Dashboard loaded.`
- `Dashboard loaded with 2 failed sections.`
- `Provider health checked: 9router is Healthy.`
- `Provider key rotated: 9router. 3 aliases synced.`
- `Provider disabled: 9router. 3 aliases were disabled.`
- `Alias synced: code-premium.`
- `Alias disabled: code-premium.`
- `Developer key issued for dev@example.com.`
- `Developer key revoked: sk-abcd.`
- `Usage refreshed from LiteLLM spend logs.`
- `Usage refresh failed. Check LiteLLM spend logs and retry.`
- `Token cleared. Dashboard data removed from this browser.`

Behavior:

- Success toasts auto-dismiss.
- Info toasts auto-dismiss.
- Warning toasts stay longer than success.
- Danger toasts persist until dismissed.
- Danger toasts include recovery guidance when possible.

## Aggressive Improvements

These materially improve operational maturity but require component and state
changes.

### Section-Level State

Replace the single global `loading` and `errors` behavior with section-aware
state.

Recommended shape:

```ts
type LoadStatus = 'idle' | 'loading' | 'current' | 'stale' | 'failed';

type SectionState = {
  status: LoadStatus;
  lastLoadedAt: Date | null;
  error?: string;
};

type SectionStates = Record<SectionKey, SectionState>;
```

Required behavior:

- Each dashboard section tracks its own `loading`, `current`, `stale`, and
  `failed` state.
- If a reload fails for a section but previous data exists, keep the previous
  rows visible and mark the section `Stale`.
- If a section has no data and fails, mark it `Failed`.
- Each failed section gets its own `Retry section` action.
- The top-level partial failure banner must say:
  `Some dashboard data failed to load.`

Partial failure banner copy:

`Some dashboard data failed to load. Loaded sections may be current, but failed sections are showing stale or missing data.`

Failed section row copy:

- `Providers failed to load. Check the admin API and retry.`
- `Usage failed to load. Check LiteLLM spend logs and retry.`
- `Keys failed to load. Existing key data may be stale.`

### Object-Level Pending State

Attach pending feedback to the changed object, not just the page.

Recommended state:

```ts
type PendingAction =
  | { kind: 'provider-health'; id: string }
  | { kind: 'provider-rotate'; id: string }
  | { kind: 'provider-disable'; id: string }
  | { kind: 'alias-sync'; id: string }
  | { kind: 'alias-disable'; id: string }
  | { kind: 'key-revoke'; id: string }
  | { kind: 'usage-refresh' };
```

Required row feedback:

- Provider health check: row badge `Checking...`
- Provider key rotation: row badge `Rotating key...`
- Provider disable: row badge `Disabling...`
- Alias sync: row badge `Syncing...`
- Alias disable: row badge `Disabling...`
- Key revoke: row badge `Revoking...`
- Usage refresh: panel badge `Refreshing...`

Disable only the action currently pending for that object. Do not freeze the
whole dashboard unless the whole dashboard is loading.

### Row Action Menus

Current issue: destructive actions such as `Disable` and `Revoke` appear as
ordinary row buttons beside safe actions.

Target rules:

- Safe/common actions may remain visible.
- Rare or risky actions move into an action menu.
- Destructive actions are separated by a divider and use danger styling.

Providers:

- Visible: `Check health`
- Menu: `View details`, `Rotate key`, `Disable provider`

Aliases:

- Visible: `Sync alias`
- Menu: `View details`, `Disable alias`

Developer keys:

- Visible: `View details`
- Menu: `Revoke key`

Action menu requirements:

- Button label: `More actions` or icon-only with accessible label
  `Provider actions`, `Alias actions`, or `Key actions`.
- Destructive menu items use danger text and a top border/divider.
- The menu closes when a modal opens.

### Destructive Confirmation Modals

All destructive and risky modals must include:

- Object name.
- Affected object count.
- Traffic impact.
- Reversibility.
- Recovery steps.
- Typed confirmation.
- Exact destructive action button.

Provider disable modal:

Title: `Disable provider`

Body:

`This disables provider 9router and 3 enabled aliases that route through it. Traffic using those aliases may fail immediately. Historical usage data is preserved. To recover, re-enable or recreate the provider, then sync affected aliases.`

Confirmation label:

`Type 9router to disable this provider.`

Buttons:

- `Cancel`
- `Disable provider`

Provider rotate modal:

Title: `Rotate provider key`

Body:

`This replaces the stored credential for 9router and syncs 3 affected aliases. Traffic may fail if the new key is invalid. To recover, rotate back to a working key and run Check health.`

Buttons:

- `Cancel`
- `Rotate key and sync aliases`

Alias disable modal:

Title: `Disable alias`

Body:

`This disables alias code-premium. Clients using this model name may fail immediately until they switch routes or the alias is restored. To recover, recreate or re-enable the alias and sync it.`

Buttons:

- `Cancel`
- `Disable alias`

Key revoke modal:

Title: `Revoke developer key`

Body:

`This revokes key sk-abcd for dev@example.com. Existing clients using this key will fail immediately. Revocation cannot reveal the old key again. To recover, issue a new developer key.`

Buttons:

- `Cancel`
- `Revoke key`

### Users & Keys Flow

Current issue: `Invite Developer` and `Issue Personal Key` are equal-weight
panels even though operators are trying to complete one workflow.

Target flow:

1. `Developer`
   - Select an existing developer.
   - Or create a new developer inline.
2. `Access`
   - Key name.
   - Allowed aliases.
3. `Issue key`
   - Primary action: `Issue developer key`.

Panel title:

`Issue developer key`

Helper text:

`Developer keys are LiteLLM virtual keys. Each key belongs to one developer and should be stored in their secret manager.`

After key creation:

- Show a dominant one-time secret panel above the flow.
- Temporarily collapse or visually demote the keys table until the operator
  clicks `I saved this key`.
- Do not auto-hide the secret panel.

One-time secret panel copy:

Title: `Developer key created`

Body:

`Copy this key now. It will not be shown again.`

Buttons:

- `Copy key`
- `I saved this key`

Copied feedback:

- Button changes from `Copy key` to `Copied` for a short duration.
- Also show success toast: `Developer key copied.`

### Table Hierarchy

Tables should be dense but faster to scan.

Providers columns:

1. `Provider`
   - Primary: slug.
   - Secondary: name.
2. `Endpoint`
   - Base URL, truncated.
3. `Enabled`
   - `Enabled` or `Disabled`.
4. `Health`
   - `Healthy`, `Unhealthy`, `Unchecked`, or pending state.
5. `Last health check`
   - Relative and absolute time.
6. `Key`
   - `Ending in 1234` or `No key`.
7. `Actions`

Aliases columns:

1. `Alias`
2. `Provider`
3. `Upstream model`
4. `Enabled`
5. `Last synced`
6. `Actions`

Developer keys columns:

1. `Developer key`
   - Primary: key name.
   - Secondary: prefix and alias.
2. `Developer`
   - Prefer email or name over raw `userId`.
3. `Team`
4. `Status`
5. `Created`
6. `Last used`
7. `Actions`

Usage columns:

1. Human-readable grouping label.
2. `Requests`
3. `Tokens`
4. `Estimated cost`

Time display:

- Show relative time first: `12m ago`.
- Show absolute time as secondary text or title text:
  `Jun 30, 2026, 03:18`.
- If missing, show `Never`, not `-`, for operational timestamps.

## Speculative Improvements

Only implement these if the safe and aggressive work is complete.

### Operator Command Drawer

Add a compact command drawer for high-frequency operator actions:

- `Load dashboard`
- `Check all providers`
- `Refresh usage`
- `Issue developer key`

This should improve speed, not become a feature showcase.

### Incident Overview Mode

Add a compact overview variant focused only on:

- Failed sections.
- Unhealthy providers.
- Stale usage.
- Disabled aliases.
- Recent destructive actions.

This is valuable only if it reduces incident triage time.

### Recovery Shortcuts

After risky actions, show contextual recovery links when supported by the current
data model:

- `Provider disabled: 9router. Review affected aliases.`
- `Key revoked. Issue replacement key.`

## Visual System Rules

### Buttons

Primary:

- One per major surface.
- Used for direct operational progress:
  `Load dashboard`, `Issue developer key`, `Add provider`, `Create and sync alias`.

Secondary:

- Safe, reversible actions:
  `Check health`, `Sync alias`, `Refresh usage`, `View details`.

Utility:

- Low-frequency or low-risk support actions:
  `Copy Codex config`, `Clear token`, `Copy key`.
- Visually quieter than secondary actions.

Destructive:

- Never exposed as ordinary row buttons.
- Use only in danger confirmation modals or separated menu items.
- Button text must match the destructive action exactly:
  `Revoke key`, `Disable provider`, `Disable alias`.

### Badges

Badges are semantic state indicators only. Do not use badges for generic
category labels such as `Virtual keys` or `LiteLLM routes`.

Allowed status labels:

- `Active`
- `Revoked`
- `Enabled`
- `Disabled`
- `Healthy`
- `Unhealthy`
- `Unchecked`
- `Loading`
- `Failed`
- `Stale`
- `Current`

Tone mapping:

- Success: `Active`, `Enabled`, `Healthy`, `Current`.
- Warning: `Unchecked`, `Stale`, partial failure.
- Danger: `Unhealthy`, `Failed`, destructive failure.
- Neutral: `Disabled`, `Revoked`, unavailable data.
- Info: pending or informational states only when not warning/danger.

### Tables

- Primary identifier is bold.
- Secondary metadata is muted and smaller.
- Numeric values use tabular numbers.
- Action columns are compact.
- Rare actions are hidden in menus.
- Destructive actions are separated inside menus.
- Empty tables show a next action.
- Failed tables show a retry action and stale-data status when applicable.

### Modals

- Modal title names the operation.
- Body explains operational impact.
- Danger modals require typed confirmation.
- Danger modal primary button is danger-styled.
- Rotation modals are treated as risky even if not destructive.
- Details modals are read-only and do not use danger styling.

### Toasts

- No generic messages.
- Success messages name the completed action.
- Warning messages explain degraded state.
- Danger messages persist until dismissed.
- Danger messages include recovery guidance when possible.

### Loading States

- Global dashboard load: primary button spinner and section shimmer.
- Section load: section-level shimmer and status badge.
- Object action: inline pending badge in the row.
- Copy action: button changes to `Copied`.
- Do not block unrelated rows for object-level actions.

### Empty States

- State what is missing.
- State the next direct action.
- Do not use marketing language.
- Do not explain the entire product.

## Motion Rules

Use motion only to improve confidence and continuity.

Recommended:

- Refresh button spinner while dashboard is loading.
- Section shimmer for loading sections.
- Inline pending badges on changed rows.
- Copy button temporary `Copied` state.
- Modal fade/scale entry under 160ms.
- Active sidebar indicator transition under 160ms.
- Table update fade under 140ms for changed rows.

Avoid:

- Decorative loops.
- Large page transitions.
- Slow row animations.
- Motion that delays table scanning.

CSS requirements:

- Respect `prefers-reduced-motion`.
- Keep durations below 180ms for operational interactions.
- Animate opacity, transform, color, and background only.
- Do not animate table layout dimensions.

## Component Work Plan

### New or Updated Components

- `DashboardStatusBadge`
  - Computes token, loading, current, stale, and partial-failure display.
- `SectionFrame`
  - Wraps each major section with status, freshness, retry, and error state.
- `ActionMenu`
  - Handles row menus and destructive separation.
- `DangerConfirmModal`
  - Standardizes blast radius, typed confirmation, and recovery copy.
- `PersistentToast`
  - Supports dismissible danger toasts.
- `InlinePendingBadge`
  - Displays object-level action progress.
- `RelativeTime`
  - Shows relative plus absolute timestamp.
- `DeveloperKeyFlow`
  - Replaces equal-weight invite/key panels.
- `OneTimeSecretPanel`
  - Holds newly generated key until copied or acknowledged.

### Existing Component Changes

- `Button`
  - Add variants: `primary`, `secondary`, `utility`, `danger`, `danger-ghost`.
  - Add loading prop and spinner.
- `Badge`
  - Enforce title-case display.
  - Separate visual tone from raw API values.
- `DataTable`
  - Support row action menus.
  - Support stale/failed empty state variants.
  - Add update transition class for changed rows.
- `TableToolbar`
  - Replace generic `Search...` with contextual placeholders:
    `Search providers`, `Search aliases`, `Search developer keys`.
- `Modal`
  - Split generic modal state into details, risky rotation, and destructive
    confirmation variants.

## Completion Criteria

The redesign should be considered complete only when the current UI satisfies
all of these checks:

- Topbar has one primary dashboard load/reload action.
- `Clear token` is no longer an equal-weight topbar action.
- No destructive action appears as an ordinary row button.
- All risky actions use separated menu items and confirmation modals.
- Danger feedback persists until dismissed.
- Every toast names the exact action and object where possible.
- Section-level loading, stale, failed, partial, and retry states exist.
- Object-level pending states exist for health, sync, rotate, disable, revoke,
  and usage refresh.
- Users & Keys uses a guided developer-key flow.
- Newly issued keys show a persistent one-time secret panel.
- Empty states name the next direct action.
- Status labels use consistent title case.
- Human-readable identifiers appear before raw IDs where data allows.
- Tables separate enabled state, health, and freshness.
- CSS includes subtle operational motion and `prefers-reduced-motion`.
- Help/runbook content is visually quieter than operational controls.
