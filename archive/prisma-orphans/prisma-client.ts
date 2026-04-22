/**
 * Prisma Client Singleton
 */

import { PrismaClient } from '@prisma/client';
import { log } from '../src/utils/logger';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });
};

declare global {
  var prisma: ReturnType<typeof prismaClientSingleton> | undefined;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

// Logging de queries em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  // @ts-ignore
  prisma.$on('query', (e: any) => {
    if (e.duration > 100) {
      // Apenas queries lentas (> 100ms)
      log.warn('Slow query detected', { query: e.query, duration: `${e.duration}ms` });
    }
  });
}

// @ts-ignore
prisma.$on('error', (e: any) => {
  log.error('Prisma error', { error: e });
});

// @ts-ignore
prisma.$on('warn', (e: any) => {
  log.warn('Prisma warning', { warning: e });
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export default prisma;
