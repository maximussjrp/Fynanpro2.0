/**
 * Reliability Sprint 1 — Reports hierárquico.
 *
 * Antes do fix, o relatório `/reports/by-category-hierarchical` comparava
 * `t.type === 'INCOME' / 'EXPENSE'` (uppercase), mas o schema persiste
 * lowercase ('income' / 'expense'). Resultado: relatório SEMPRE retornava
 * income=0 e expense=0.
 *
 * Este teste mocka `@prisma/client` no nível do módulo e valida que após o
 * fix os totais batem com as transações fornecidas.
 */
import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';

const transactionFindMany = jest.fn();
const categoryFindMany = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    transaction: { findMany: (...a: any[]) => transactionFindMany(...a) },
    category: { findMany: (...a: any[]) => categoryFindMany(...a) },
  })),
}));

jest.mock('../../utils/logger', () => ({
  log: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import reportsRoutes from '../../routes/reports';

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/reports', reportsRoutes);
  return app;
}

function token(): string {
  return jwt.sign(
    { userId: 'u1', tenantId: 't1', email: 'a@b.com' },
    process.env.JWT_SECRET || 'test-secret-key-with-32-characters-minimum',
    { expiresIn: '15m' },
  );
}

describe('Reports reliability — hierarchical case fix', () => {
  let app: Express;
  let bearer: string;

  beforeAll(() => {
    app = makeApp();
    bearer = token();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna totalIncome e totalExpense > 0 quando há transações lowercase', async () => {
    transactionFindMany.mockResolvedValue([
      { id: 't1', categoryId: 'cat-inc', type: 'income', amount: 5000, transactionDate: new Date('2026-01-15') },
      { id: 't2', categoryId: 'cat-exp', type: 'expense', amount: 1500, transactionDate: new Date('2026-01-20') },
    ]);
    categoryFindMany.mockResolvedValue([
      { id: 'cat-inc', name: 'Salário', type: 'income', parentId: null, level: 1, icon: null, color: null },
      { id: 'cat-exp', name: 'Mercado', type: 'expense', parentId: null, level: 1, icon: null, color: null },
    ]);

    const res = await request(app)
      .get('/reports/hierarchical-categories?startDate=2026-01-01&endDate=2026-01-31')
      .set('Authorization', `Bearer ${bearer}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.summary.totalIncome).toBe(5000);
    expect(data.summary.totalExpense).toBe(1500);
    expect(data.income.categories.length).toBeGreaterThan(0);
    expect(data.expense.categories.length).toBeGreaterThan(0);
  });
});
