/**
 * Reliability Sprint 1 — Dashboard regressões.
 *
 * Cobre:
 * 1. /balance-summary deve excluir transfer (apenas income/expense entram).
 * 2. /expense-ranking (Pareto) deve incluir bucket "Sem categoria"
 *    e percentuais fechando em 100% do total real.
 */
import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';

// Mock prisma do módulo main (usado por dashboard.ts)
const mockTransactionFindMany = jest.fn();
const mockCategoryFindMany = jest.fn();
const mockRecurringBillOccurrenceFindMany = jest.fn();

jest.mock('../../main', () => ({
  prisma: {
    transaction: { findMany: (...args: any[]) => mockTransactionFindMany(...args) },
    category: { findMany: (...args: any[]) => mockCategoryFindMany(...args) },
    recurringBillOccurrence: {
      findMany: (...args: any[]) => mockRecurringBillOccurrenceFindMany(...args),
    },
  },
}));

jest.mock('../../utils/logger', () => ({
  log: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../services/cache.service', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    invalidateNamespace: jest.fn(),
    isAvailable: jest.fn(() => false),
  },
  CacheTTL: { DASHBOARD: 300, CATEGORIES: 3600 },
  CacheNamespace: { DASHBOARD: 'dashboard' },
}));

import dashboardRoutes from '../../routes/dashboard';

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/dashboard', dashboardRoutes);
  return app;
}

function token(): string {
  return jwt.sign(
    { userId: 'u1', tenantId: 't1', email: 'a@b.com' },
    process.env.JWT_SECRET || 'test-secret-key-with-32-characters-minimum',
    { expiresIn: '15m' },
  );
}

describe('Dashboard reliability — Sprint 1', () => {
  let app: Express;
  let bearer: string;

  beforeAll(() => {
    app = makeApp();
    bearer = token();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /dashboard/balance-summary', () => {
    it('filtra apenas type IN [income, expense] (exclui transfer)', async () => {
      mockTransactionFindMany.mockResolvedValue([]);
      mockRecurringBillOccurrenceFindMany.mockResolvedValue([]);

      await request(app)
        .get('/dashboard/balance-summary?startDate=2026-01-01&endDate=2026-01-31')
        .set('Authorization', `Bearer ${bearer}`);

      expect(mockTransactionFindMany).toHaveBeenCalled();
      const where = mockTransactionFindMany.mock.calls[0][0].where;
      expect(where.type).toEqual({ in: ['income', 'expense'] });
    });
  });

  describe('GET /dashboard/expense-ranking — Pareto', () => {
    it('inclui bucket "Sem categoria" e percentuais somam 100', async () => {
      // 1ª chamada: transactions (despesas). 2ª chamada: categorias.
      mockTransactionFindMany.mockResolvedValueOnce([
        { amount: 600, categoryId: 'cat-1' },
        { amount: 300, categoryId: null }, // sem categoria
        { amount: 100, categoryId: 'cat-1' },
      ]);
      mockCategoryFindMany.mockResolvedValueOnce([
        { id: 'cat-1', name: 'Alimentação', parentId: null },
      ]);

      const res = await request(app)
        .get('/dashboard/expense-ranking?startDate=2026-01-01&endDate=2026-01-31')
        .set('Authorization', `Bearer ${bearer}`);

      expect(res.status).toBe(200);
      const { totalExpense, ranking } = res.body.data;
      expect(totalExpense).toBe(1000);

      const semCategoria = ranking.find((r: any) => r.name === 'Sem categoria');
      expect(semCategoria).toBeDefined();
      expect(semCategoria.total).toBe(300);

      const soma = ranking.reduce((acc: number, r: any) => acc + r.percentage, 0);
      expect(Math.round(soma)).toBe(100);
    });
  });
});
