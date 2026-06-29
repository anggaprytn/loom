import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const API_KEY_PREFIX = 'tlg_live';
export const LITELLM_KEY_PREFIX = 'sk';

export type GeneratedApiKey = {
  plaintext: string;
  prefix: string;
  hash: string;
};

export function hashApiKey(plaintext: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}:${plaintext}`).digest('hex');
}

export function keyPrefix(plaintext: string): string {
  const parts = plaintext.split('-');
  if (parts.length > 1 && parts[0] === LITELLM_KEY_PREFIX) {
    return LITELLM_KEY_PREFIX;
  }

  return plaintext.split('_').slice(0, 2).join('_') || plaintext.slice(0, 8);
}

export function generateApiKey(pepper: string): GeneratedApiKey {
  const secret = randomBytes(32).toString('base64url');
  const plaintext = `${API_KEY_PREFIX}_${secret}`;
  return {
    plaintext,
    prefix: API_KEY_PREFIX,
    hash: hashApiKey(plaintext, pepper),
  };
}

export function safeCompareHash(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
