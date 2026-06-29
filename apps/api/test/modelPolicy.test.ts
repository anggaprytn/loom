import { describe, expect, it } from 'vitest';
import { normalizeAllowedModels } from '../src/services/modelPolicy.js';

describe('model policy', () => {
  it('defaults to required gateway aliases', () => {
    expect(normalizeAllowedModels()).toEqual(['code-premium', 'code-balanced', 'code-fallback']);
  });

  it('deduplicates and drops unknown models', () => {
    expect(normalizeAllowedModels(['code-premium', 'unknown-model', 'code-premium'])).toEqual([
      'code-premium',
    ]);
  });
});
