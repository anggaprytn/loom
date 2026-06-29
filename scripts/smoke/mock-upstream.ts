import { maybeStartMockUpstream } from './client.js';

process.env.SMOKE_MOCK_UPSTREAM = '1';

const server = await maybeStartMockUpstream();

if (!server) {
  throw new Error('failed to start mock upstream');
}

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
