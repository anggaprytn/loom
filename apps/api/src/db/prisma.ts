import { PrismaClient } from '@prisma/client';

export function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export type PrismaLike = PrismaClient;
