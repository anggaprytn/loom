import { describe, expect, it } from 'vitest';
import { assertKeyUsable, createKeyMaterial } from '../src/services/keyService.js';
import { hashApiKey } from '../src/utils/apiKey.js';

describe('key service', () => {
  it('creates prefix-identifiable keys and stores only hashes', () => {
    const material = createKeyMaterial('pepper-1234567890');

    expect(material.plaintext).toMatch(/^tlg_live_/);
    expect(material.prefix).toBe('tlg_live');
    expect(material.hash).toBe(hashApiKey(material.plaintext, 'pepper-1234567890'));
    expect(material.hash).not.toContain(material.plaintext);
  });

  it('rejects revoked keys', () => {
    expect(() => assertKeyUsable({ status: 'revoked' })).toThrow(/revoked/);
  });
});
