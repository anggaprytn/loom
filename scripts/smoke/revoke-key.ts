import { adminFetch, expectRejected, loadSmokeContext } from './client.js';

const ctx = loadSmokeContext();
const keyId = process.env.SMOKE_KEY_ID;
const apiKey = process.env.SMOKE_API_KEY;
if (!keyId || !apiKey) {
  throw new Error('SMOKE_KEY_ID and SMOKE_API_KEY are required');
}

await adminFetch(ctx, `/admin/keys/${keyId}/revoke`, { method: 'POST' });
await expectRejected(`${ctx.litellmUrl}/v1/models`, apiKey);
console.log('revoked key was rejected by LiteLLM');
