import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

describe('loadEnv', () => {
  it('validates required config', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      ADMIN_TOKEN: '1234567890123456',
      API_KEY_PEPPER: '1234567890123456',
    });

    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('rejects short admin tokens', () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        ADMIN_TOKEN: 'short',
        API_KEY_PEPPER: '1234567890123456',
      }),
    ).toThrow(/ADMIN_TOKEN/);
  });
});
