import { liteLlmFetch, loadSmokeContext } from './client.js';

const ctx = loadSmokeContext();
const key = process.env.SMOKE_API_KEY;
if (!key) {
  throw new Error('SMOKE_API_KEY is required');
}

await liteLlmFetch(ctx, '/v1/models', key);
const completion = await liteLlmFetch(ctx, '/v1/chat/completions', key, {
  method: 'POST',
  body: JSON.stringify({
    model: ctx.model,
    messages: [{ role: 'user', content: 'Say ok' }],
  }),
});

console.log(JSON.stringify(completion, null, 2));
