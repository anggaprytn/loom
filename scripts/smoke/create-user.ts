import { adminFetch, loadSmokeContext } from './client.js';

const ctx = loadSmokeContext();
const suffix = Date.now();
const user = await adminFetch<{ id: string; email: string }>(ctx, '/admin/users', {
  method: 'POST',
  body: JSON.stringify({
    email: `smoke-${suffix}@example.com`,
    name: 'Smoke Test',
    team: { slug: 'smoke', name: 'Smoke' },
  }),
});

console.log(JSON.stringify(user, null, 2));
