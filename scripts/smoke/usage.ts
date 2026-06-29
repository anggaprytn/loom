import { adminFetch, loadSmokeContext } from './client.js';

const ctx = loadSmokeContext();
const usage = await adminFetch(ctx, '/admin/usage?source=litellm');

console.log(JSON.stringify(usage, null, 2));
