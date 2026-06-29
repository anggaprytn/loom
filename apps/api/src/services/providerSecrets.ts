import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const algorithm = 'aes-256-gcm';

export function encryptProviderSecret(secret: string, secretKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, deriveKey(secretKey), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptProviderSecret(encrypted: string, secretKey: string): string {
  const [version, iv, tag, ciphertext] = encrypted.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext) {
    throw new Error('Unsupported provider secret format');
  }

  const decipher = createDecipheriv(algorithm, deriveKey(secretKey), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function secretLast4(secret: string): string {
  return secret.slice(-4);
}

function deriveKey(secretKey: string): Buffer {
  return createHash('sha256').update(secretKey).digest();
}
