/**
 * Routes públicas para dados DEMO (sem autenticação).
 * Usadas na landing page para mostrar dashboard exemplo.
 *
 * GET /api/v1/demo/dashboard — retorna dados públicos do tenant demo
 */

import type { Response } from 'express';
import { Router } from 'express';
import { log } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const DEMO_SLUG = 'familia-silva-demo';
const DEMO_CACHE_TTL = 300; // 5 min

// Cache em memória (simples, sem redis)
const cache = new Map<string, { data: any; expires: number }>();

/**
 * GET /demo/dashboard
 * Retorna: saldo, últimas transações, contas recorrentes, gráficos
 */
router.get('/dashboard', async (_req, res: Response) => {
  try {
    // Verificar cache
    const cached = cache.get('demo:dashboard');
    if (cached && cached.expires > Date.now()) {
      return res.json(cached.data);
    }

    // Buscar tenant demo
    const tenant = await prisma.tenant.findUnique({
      where: { slug: DEMO_SLUG },
      include: {
        owner: { select: { fullName: true } },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Demo tenant não encontrado' });
    }

    const T = tenant.id;
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    // ────────────────────────────────────────────────────────────────────
    // Dados públicos que podem ser mostrados na landing
    // ────────────────────────────────────────────────────────────────────

    // 1. Contas bancárias (apenas nome e saldo)
    const accounts = await prisma.bankAccount.findMany({
      where: { tenantId: T, isActive: true },
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
        currentBalance: true,
        type: true,
      },
      orderBy: { order: 'asc' },
    });

    // 2. Últimas 10 transações
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        tenantId: T,
        deletedAt: null,
      },
      select: {
        id: true,
        description: true,
        amount: true,
        type: true,
        transactionDate: true,
        status: true,
        category: { select: { name: true, icon: true, color: true } },
      },
      orderBy: { transactionDate: 'desc' },
      take: 10,
    });

    // 3. Contas recorrentes ativas
    const recurringBills = await prisma.recurringBill.findMany({
      where: { tenantId: T, status: 'active', deletedAt: null },
      select: {
        id: true,
        name: true,
        amount: true,
        dueDay: true,
        type: true,
        category: { select: { name: true, icon: true, color: true } },
      },
      orderBy: { dueDay: 'asc' },
    });

    // 4. Resumo de receita vs despesa (últimos 6 meses)
    const txByMonth = await prisma.transaction.groupBy({
      by: ['type', 'transactionDate'],
      where: {
        tenantId: T,
        deletedAt: null,
        transactionDate: { gte: sixMonthsAgo },
        status: { in: ['completed', 'paid'] },
      },
      _sum: { amount: true },
    });

    // Agrupar por mês
    const monthlyData: Record<
      string,
      { income: number; expense: number; month: string }
    > = {};
    txByMonth.forEach((row) => {
      const month = new Date(row.transactionDate).toLocaleString('pt-BR', {
        month: 'short',
        year: '2-digit',
      });
      if (!monthlyData[month]) {
        monthlyData[month] = { income: 0, expense: 0, month };
      }
      if (row.type === 'income') {
        monthlyData[month].income += Number(row._sum.amount || 0);
      } else {
        monthlyData[month].expense += Number(row._sum.amount || 0);
      }
    });

    const chartData = Object.values(monthlyData).slice(-6); // últimos 6 meses

    // 5. Totais
    const totalIncome = await prisma.transaction.aggregate({
      where: {
        tenantId: T,
        type: 'income',
        deletedAt: null,
        status: { in: ['completed', 'paid'] },
      },
      _sum: { amount: true },
    });

    const totalExpense = await prisma.transaction.aggregate({
      where: {
        tenantId: T,
        type: 'expense',
        deletedAt: null,
        status: { in: ['completed', 'paid'] },
      },
      _sum: { amount: true },
    });

    // Saldo total
    const totalBalance = accounts.reduce(
      (sum, acc) => sum + Number(acc.currentBalance || 0),
      0
    );

    const result = {
      tenant: {
        name: tenant.name,
        owner: tenant.owner.fullName,
      },
      balances: {
        total: totalBalance,
        income: Number(totalIncome._sum.amount || 0),
        expense: Number(totalExpense._sum.amount || 0),
      },
      accounts,
      recentTransactions,
      recurringBills,
      chartData,
      generatedAt: new Date().toISOString(),
    };

    // Cachear
    cache.set('demo:dashboard', {
      data: result,
      expires: Date.now() + DEMO_CACHE_TTL * 1000,
    });

    res.json(result);
  } catch (error: any) {
    log.error('Demo dashboard error', { error: error?.message });
    res.status(500).json({ error: 'Erro ao buscar dados demo' });
  }
});

export default router;
