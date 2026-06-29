export const DEFAULT_ALLOWED_MODELS = ['code-premium', 'code-balanced', 'code-fallback'] as const;

export const ALL_PUBLIC_MODELS = [
  'code-premium',
  'code-balanced',
  'code-fast',
  'code-fallback',
  'agent-premium',
  'agent-cheap',
  'codex-default',
  'codex-premium',
] as const;

export type PublicModel = (typeof ALL_PUBLIC_MODELS)[number];

export function normalizeAllowedModels(models?: string[]): string[] {
  if (!models?.length) {
    return [...DEFAULT_ALLOWED_MODELS];
  }

  const allowed = new Set<string>(ALL_PUBLIC_MODELS);
  return [...new Set(models)].filter((model) => allowed.has(model));
}
