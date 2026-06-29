import { describe, expect, it } from 'vitest';
import {
  decryptProviderSecret,
  encryptProviderSecret,
  secretLast4,
} from '../src/services/providerSecrets.js';

describe('provider secrets', () => {
  it('encrypts provider API keys reversibly without storing plaintext', () => {
    const encrypted = encryptProviderSecret('provider-secret-key', 'a'.repeat(32));

    expect(encrypted).not.toContain('provider-secret-key');
    expect(decryptProviderSecret(encrypted, 'a'.repeat(32))).toBe('provider-secret-key');
    expect(secretLast4('provider-secret-key')).toBe('-key');
  });
});
