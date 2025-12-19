import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { log } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/planning/annual
 * Retorna o planejamento anual completo
 */
router.get('/annual', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const { year } = req.query;
    
    const planningYear = year ? parseInt(year as string) : new Date().getFullYear();
    
    // Buscar receitas recorrentes do modelo antigo (RecurringBill)
    const oldRecurringIncomes = await prisma.recurringBill.findMany({
      where: {
        tenantId,
        type: 'income',
        status: 'active',
        deletedAt: null,
      },
      include: {
        category: true,
        bankAccount: true,
      },
      orderBy: { dueDay: 'asc' },
    });
    
    // Buscar despesas recorrentes do modelo antigo (RecurringBill)
    const oldRecurringExpenses = await prisma.recurringBill.findMany({
      where: {
        tenantId,
        type: 'expense',
        status: 'active',
        deletedAt: null,
      },
      include: {
        category: true,
        bankAccount: true,
      },
      orderBy: { dueDay: 'asc' },
    });

    // NOVO: Buscar transações recorrentes do modelo unificado (Transaction)
    // Buscar TODAS as transações recorrentes (ativas) para identificar contas fixas
    const unifiedRecurringTransactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        transactionType: 'recurring',
        deletedAt: null,
      },
      include: {
        category: true,
        bankAccount: true,
      },
      orderBy: { transactionDate: 'asc' },
    });

    // Agrupar transações por parentId para encontrar recorrentes únicas
    // Se tem parentId, usa ele; se não tem (é a própria "pai"), usa o id
    const recurringParentIds = new Set<string>();
    const recurringFromTransactions: {
      id: string;
      name: string;
      amount: number;
      dueDay: number;
      type: string;
      category?: string;
      bankAccount?: string;
    }[] = [];

    unifiedRecurringTransactions.forEach((t) => {
      const parentId = t.parentId || t.id;
      if (!recurringParentIds.has(parentId)) {
        recurringParentIds.add(parentId);
        const txDate = new Date(t.transactionDate);
        recurringFromTransactions.push({
          id: parentId,
          name: t.description || 'Sem nome',
          amount: Number(t.amount),
          dueDay: txDate.getDate(),
          type: t.type,
          category: t.category?.name,
          bankAccount: t.bankAccount?.name,
        });
      }
    });

    // Combinar recorrentes do modelo antigo com o novo
    const recurringIncomes = [
      ...oldRecurringIncomes.map(r => ({
        id: r.id,
        name: r.name,
        amount: Number(r.amount),
        dueDay: r.dueDay,
        category: r.category?.name,
        bankAccount: r.bankAccount?.name,
      })),
      ...recurringFromTransactions.filter(r => r.type === 'income'),
    ];

    const recurringExpenses = [
      ...oldRecurringExpenses.map(r => ({
        id: r.id,
        name: r.name,
        amount: Number(r.amount),
        dueDay: r.dueDay,
        category: r.category?.name,
        bankAccount: r.bankAccount?.name,
      })),
      ...recurringFromTransactions.filter(r => r.type === 'expense'),
    ];
    
    // Buscar orçamentos por categoria
    const budgets = await prisma.budget.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      include: {
        category: true,
      },
    });
    
    // Buscar transações realizadas no ano para comparação
    const startOfYear = new Date(planningYear, 0, 1);
    const endOfYear = new Date(planningYear, 11, 31, 23, 59, 59);
    
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        transactionDate: {
          gte: startOfYear,
          lte: endOfYear,
        },
        deletedAt: null,
      },
      select: {
        type: true,
        amount: true,
        status: true,
        transactionDate: true,
        categoryId: true,
      },
    });
    
    // Buscar saldo atual das contas
    const accounts = await prisma.bankAccount.findMany({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        currentBalance: true,
      },
    });
    
    const currentBalance = accounts.reduce((sum, acc) => sum + Number(acc.currentBalance), 0);
    
    // Montar planejamento mês a mês
    const months = [];
    
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(planningYear, month, 1);
      const monthEnd = new Date(planningYear, month + 1, 0, 23, 59, 59);
      const monthName = monthStart.toLocaleDateString('pt-BR', { month: 'long' });
      
      // Receitas planejadas
      const plannedIncome = recurringIncomes.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      
      // Despesas planejadas
      const plannedExpense = recurringExpenses.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      
      // Transações realizadas no mês
      const monthTransactions = transactions.filter(t => {
        const txDate = new Date(t.transactionDate);
        return txDate >= monthStart && txDate <= monthEnd;
      });
      
      const realizedIncome = monthTransactions
        .filter(t => t.type === 'income' && t.status === 'completed')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const realizedExpense = monthTransactions
        .filter(t => t.type === 'expense' && t.status === 'completed')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const pendingIncome = monthTransactions
        .filter(t => t.type === 'income' && t.status !== 'completed')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const pendingExpense = monthTransactions
        .filter(t => t.type === 'expense' && t.status !== 'completed')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const plannedBalance = plannedIncome - plannedExpense;
      const realizedBalance = realizedIncome - realizedExpense;
      
      months.push({
        month: month + 1,
        monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        year: planningYear,
        planned: {
          income: plannedIncome,
          expense: plannedExpense,
          balance: plannedBalance,
        },
        realized: {
          income: realizedIncome,
          expense: realizedExpense,
          balance: realizedBalance,
        },
        pending: {
          income: pendingIncome,
          expense: pendingExpense,
        },
        variance: {
          income: realizedIncome - plannedIncome,
          expense: realizedExpense - plannedExpense,
          balance: realizedBalance - plannedBalance,
        },
      });
    }
    
    // Calcular totais anuais
    const annualTotals = {
      planned: {
        income: months.reduce((sum, m) => sum + m.planned.income, 0),
        expense: months.reduce((sum, m) => sum + m.planned.expense, 0),
        balance: months.reduce((sum, m) => sum + m.planned.balance, 0),
      },
      realized: {
        income: months.reduce((sum, m) => sum + m.realized.income, 0),
        expense: months.reduce((sum, m) => sum + m.realized.expense, 0),
        balance: months.reduce((sum, m) => sum + m.realized.balance, 0),
      },
    };
    
    return successResponse(res, {
      year: planningYear,
      currentBalance,
      months,
      annualTotals,
      recurringIncomes: recurringIncomes.map(r => ({
        id: r.id,
        name: r.name,
        amount: Number(r.amount),
        dueDay: r.dueDay,
        category: r.category,
        bankAccount: r.bankAccount,
      })),
      recurringExpenses: recurringExpenses.map(r => ({
        id: r.id,
        name: r.name,
        amount: Number(r.amount),
        dueDay: r.dueDay,
        category: r.category,
        bankAccount: r.bankAccount,
      })),
      budgets: budgets.map(b => ({
        id: b.id,
        name: b.name,
        amount: Number(b.amount),
        category: b.category?.name,
      })),
      accounts,
    });
  } catch (error) {
    log.error('Error getting annual planning', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar planejamento anual', 500);
  }
});

/**
 * POST /api/v1/planning/start-year
 * Inicia/configura o planejamento do ano
 */
router.post('/start-year', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const { year, copyFromPrevious } = req.body;
    
    const planningYear = year || new Date().getFullYear();
    
    if (copyFromPrevious) {
      // Copiar recorrentes do ano anterior
      const previousYear = planningYear - 1;
      
      // Buscar recorrentes ativos
      const existingRecurring = await prisma.recurringBill.findMany({
        where: {
          tenantId,
          status: 'active',
          deletedAt: null,
        },
      });
      
      // Atualizar datas de início para o novo ano
      for (const recurring of existingRecurring) {
        await prisma.recurringBill.update({
          where: { id: recurring.id },
          data: {
            firstDueDate: new Date(planningYear, 0, recurring.dueDay || 1),
          },
        });
      }
    }
    
    // Gerar ocorrências para todos os meses do ano
    const recurringBills = await prisma.recurringBill.findMany({
      where: {
        tenantId,
        status: 'active',
        deletedAt: null,
      },
    });
    
    let createdOccurrences = 0;
    
    for (const bill of recurringBills) {
      for (let month = 0; month < 12; month++) {
        const dueDate = new Date(planningYear, month, bill.dueDay || 1);
        
        // Verificar se já existe ocorrência
        const existing = await prisma.recurringBillOccurrence.findFirst({
          where: {
            recurringBillId: bill.id,
            dueDate: {
              gte: new Date(planningYear, month, 1),
              lt: new Date(planningYear, month + 1, 1),
            },
          },
        });
        
        if (!existing) {
          await prisma.recurringBillOccurrence.create({
            data: {
              tenantId,
              recurringBillId: bill.id,
              dueDate,
              amount: bill.amount || 0,
              status: 'pending',
            },
          });
          createdOccurrences++;
        }
      }
    }
    
    return successResponse(res, {
      message: `Planejamento de ${planningYear} configurado com sucesso`,
      year: planningYear,
      createdOccurrences,
    });
  } catch (error) {
    log.error('Error starting year planning', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao iniciar planejamento do ano', 500);
  }
});

/**
 * POST /api/v1/planning/recurring
 * Adiciona uma receita/despesa recorrente ao planejamento
 */
router.post('/recurring', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const { name, type, amount, dueDay, categoryId, bankAccountId, isFixed, startMonth, endMonth } = req.body;
    
    if (!name || !type || !amount || !dueDay) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Nome, tipo, valor e dia de vencimento são obrigatórios', 400);
    }
    
    const recurring = await prisma.recurringBill.create({
      data: {
        tenantId,
        name,
        type, // 'income' or 'expense'
        amount,
        dueDay,
        categoryId,
        bankAccountId,
        isFixed: isFixed !== false,
        frequency: 'monthly',
        status: 'active',
        firstDueDate: new Date(),
      },
      include: {
        category: true,
        bankAccount: true,
      },
    });
    
    // Gerar ocorrências para o resto do ano
    const currentYear = new Date().getFullYear();
    const currentMonth = startMonth ? startMonth - 1 : new Date().getMonth();
    const finalMonth = endMonth ? endMonth - 1 : 11;
    
    for (let month = currentMonth; month <= finalMonth; month++) {
      const dueDate = new Date(currentYear, month, dueDay);
      
      await prisma.recurringBillOccurrence.create({
        data: {
          tenantId,
          recurringBillId: recurring.id,
          dueDate,
          amount,
          status: 'pending',
        },
      });
    }
    
    return successResponse(res, {
      recurring: {
        id: recurring.id,
        name: recurring.name,
        type: recurring.type,
        amount: Number(recurring.amount),
        dueDay: recurring.dueDay,
        category: recurring.category?.name,
        bankAccount: recurring.bankAccount?.name,
      },
    }, 201);
  } catch (error) {
    log.error('Error creating recurring', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao criar recorrente', 500);
  }
});

/**
 * GET /api/v1/planning/summary
 * Resumo rápido do planejamento para widgets
 */
router.get('/summary', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    // Buscar totais de recorrentes
    const incomeTotal = await prisma.recurringBill.aggregate({
      where: {
        tenantId,
        type: 'income',
        status: 'active',
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: true,
    });
    
    const expenseTotal = await prisma.recurringBill.aggregate({
      where: {
        tenantId,
        type: 'expense',
        status: 'active',
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: true,
    });
    
    const monthlyPlannedIncome = Number(incomeTotal._sum.amount) || 0;
    const monthlyPlannedExpense = Number(expenseTotal._sum.amount) || 0;
    const monthlyBalance = monthlyPlannedIncome - monthlyPlannedExpense;
    
    // Projeção anual
    const remainingMonths = 12 - currentMonth;
    const annualProjectedBalance = monthlyBalance * remainingMonths;
    
    // Saldo atual
    const accounts = await prisma.bankAccount.aggregate({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
      },
      _sum: { currentBalance: true },
    });
    
    const currentBalance = Number(accounts._sum.currentBalance) || 0;
    const projectedYearEndBalance = currentBalance + annualProjectedBalance;
    
    return successResponse(res, {
      monthly: {
        income: monthlyPlannedIncome,
        expense: monthlyPlannedExpense,
        balance: monthlyBalance,
        incomeCount: incomeTotal._count,
        expenseCount: expenseTotal._count,
      },
      annual: {
        income: monthlyPlannedIncome * 12,
        expense: monthlyPlannedExpense * 12,
        balance: monthlyBalance * 12,
      },
      projection: {
        currentBalance,
        remainingMonths,
        projectedYearEndBalance,
      },
    });
  } catch (error) {
    log.error('Error getting planning summary', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar resumo do planejamento', 500);
  }
});

export default router;
