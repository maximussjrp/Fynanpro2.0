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

  it('usa rateios por categoria no hierarquico sem duplicar o valor principal', async () => {
    transactionFindMany.mockResolvedValue([
      {
        id: 't-split',
        categoryId: 'cat-main',
        type: 'expense',
        amount: 230,
        transactionDate: new Date('2026-01-20'),
        categorySplits: [
          { categoryId: 'cat-food', amount: 160 },
          { categoryId: 'cat-hygiene', amount: 45 },
          { categoryId: 'cat-pet', amount: 25 },
        ],
      },
    ]);
    categoryFindMany.mockResolvedValue([
      { id: 'cat-main', name: 'Mercado', type: 'expense', parentId: null, level: 1, icon: null, color: null },
      { id: 'cat-food', name: 'Alimentacao', type: 'expense', parentId: null, level: 1, icon: null, color: null },
      { id: 'cat-hygiene', name: 'Higiene', type: 'expense', parentId: null, level: 1, icon: null, color: null },
      { id: 'cat-pet', name: 'Pet', type: 'expense', parentId: null, level: 1, icon: null, color: null },
    ]);

    const res = await request(app)
      .get('/reports/hierarchical-categories?startDate=2026-01-01&endDate=2026-01-31')
      .set('Authorization', `Bearer ${bearer}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalExpense).toBe(230);
    expect(res.body.data.expense.total).toBe(230);

    const categories = res.body.data.expense.categories;
    expect(categories.find((c: any) => c.id === 'cat-main')?.expense || 0).toBe(0);
    expect(categories.find((c: any) => c.id === 'cat-food')?.expense).toBe(160);
    expect(categories.find((c: any) => c.id === 'cat-hygiene')?.expense).toBe(45);
    expect(categories.find((c: any) => c.id === 'cat-pet')?.expense).toBe(25);
  });

  it('agrupa o mapa financeiro nas faixas 50/30/20', async () => {
    categoryFindMany.mockResolvedValue([
      { id: 'cat-income', name: 'Salário', type: 'income', parentId: null, level: 1, icon: '💵', semantics: null },
      { id: 'cat-needs', name: 'Moradia', type: 'expense', parentId: null, level: 1, icon: '🏠', semantics: null },
      { id: 'cat-wants', name: 'Lazer', type: 'expense', parentId: null, level: 1, icon: '🎮', semantics: null },
      { id: 'cat-priorities', name: 'Investimentos', type: 'expense', parentId: null, level: 1, icon: '📈', semantics: null },
    ]);
    transactionFindMany.mockResolvedValue([
      { categoryId: 'cat-income', type: 'income', amount: 10000, status: 'completed', transactionDate: new Date('2026-01-05') },
      { categoryId: 'cat-needs', type: 'expense', amount: 5000, status: 'completed', transactionDate: new Date('2026-01-10') },
      { categoryId: 'cat-wants', type: 'expense', amount: 3000, status: 'completed', transactionDate: new Date('2026-01-11') },
      { categoryId: 'cat-priorities', type: 'expense', amount: 2000, status: 'completed', transactionDate: new Date('2026-01-12') },
    ]);

    const res = await request(app)
      .get('/reports/dre?year=2026')
      .set('Authorization', `Bearer ${bearer}`);

    expect(res.status).toBe(200);
    const groups = res.body.data.despesas.expenseGroups;
    expect(groups).toHaveLength(3);

    const needs = groups.find((g: any) => g.key === 'needs');
    const wants = groups.find((g: any) => g.key === 'wants');
    const priorities = groups.find((g: any) => g.key === 'priorities');

    expect(needs.total.realizado).toBe(5000);
    expect(needs.targetPercent).toBe(50);
    expect(needs.actualPercent).toBe(50);
    expect(wants.total.realizado).toBe(3000);
    expect(wants.targetPercent).toBe(30);
    expect(wants.actualPercent).toBe(30);
    expect(priorities.total.realizado).toBe(2000);
    expect(priorities.targetPercent).toBe(20);
    expect(priorities.actualPercent).toBe(20);
  });
});
