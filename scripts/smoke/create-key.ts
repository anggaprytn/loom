import { adminFetch, loadSmokeContext } from './client.js';

const ctx = loadSmokeContext();
const userId = process.env.SMOKE_USER_ID;
if (!userId) {
  throw new Error('SMOKE_USER_ID is required');
}

const key = await adminFetch(ctx, '/admin/keys', {
  method: 'POST',
  body: JSON.stringify({
    userId,
    name: 'smoke',
    models: ['code-premium', 'code-balanced', 'code-fallback'],
  }),
});

console.log(JSON.stringify(key, null, 2));
