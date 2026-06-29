import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Env } from '../config/env.js';

export function registerAdminAuth(app: FastifyInstance, env: Env) {
  app.decorate('verifyAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = request.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : undefined;

    if (!token || token !== env.ADMIN_TOKEN) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    verifyAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
