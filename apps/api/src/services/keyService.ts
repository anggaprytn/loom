import type { ApiKeyStatus } from '@prisma/client';
import { generateApiKey } from '../utils/apiKey.js';

export type KeyState = {
  status: ApiKeyStatus | 'active' | 'revoked';
};

export function assertKeyUsable(key: KeyState | null | undefined): void {
  if (!key) {
    throw new Error('API key not found');
  }

  if (key.status !== 'active') {
    throw new Error('API key is revoked');
  }
}

export function createKeyMaterial(pepper: string) {
  return generateApiKey(pepper);
}
