/**
 * Jest Setup - Mocks e configurações globais para testes
 */

// Mock Prisma Client
export const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tenant: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    category: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    bankAccount: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    paymentMethod: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn({
      user: {
        create: jest.fn(),
        update: jest.fn(),
      },
      tenant: {
        create: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
      },
      bankAccount: {
        update: jest.fn(),
      },
    })),
    $disconnect: jest.fn(),
  };

jest.mock('../utils/prisma-client', () => ({
  prisma: mockPrisma,
}));

// Mock Logger
jest.mock('../utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
}));

// Mock Cache Service
jest.mock('../services/cache.service', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    invalidateNamespace: jest.fn(),
    invalidateMultiple: jest.fn(),
    isAvailable: jest.fn(() => false),
  },
  CacheTTL: {
    DASHBOARD: 300,
    CATEGORIES: 3600,
    BUDGETS: 900,
    REPORTS: 600,
    TRANSACTIONS: 180,
    ACCOUNTS: 600,
  },
  CacheNamespace: {
    DASHBOARD: 'dashboard',
    CATEGORIES: 'categories',
    BUDGETS: 'budgets',
    REPORTS: 'reports',
    TRANSACTIONS: 'transactions',
    ACCOUNTS: 'accounts',
  },
}));

// Mock ENV
process.env.JWT_SECRET = 'test-secret-key-with-32-characters-minimum';
process.env.JWT_EXPIRATION = '15m';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NODE_ENV = 'test';

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};
