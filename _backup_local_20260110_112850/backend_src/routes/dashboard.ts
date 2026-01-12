import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../main';
import { successResponse, errorResponse } from '../utils/response';
import { log } from '../utils/logger';
import { cacheService, CacheTTL, CacheNamespace } from '../services/cache.service';

const router = Router();

// Aplicar autenticação em todas as rotas
router.use(authMiddleware);

// 1. Saldo final médio por período
router.get('/balance-summary', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;
    const tenantId = req.tenantId!;

    if (!startDate || !endDate) {
      return errorResponse(res, 'VALIDATION_ERROR', 'startDate e endDate são obrigatórios', 400);
    }

    // Tentar buscar do cache
    const cacheKey = `${tenantId}:${startDate}:${endDate}`;
    const cached = await cacheService.get(CacheNamespace.DASHBOARD, cacheKey);
    if (cached) {
      return successResponse(res, cached);
    }

    // Buscar todas as transações do período
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        transactionDate: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        },
        deletedAt: null,
      },
      select: {
        type: true,
        amount: true,
        status: true,
        transactionDate: true,
      },
    });

    // Buscar ocorrências pendentes de recorrências no período
    const pendingOccurrences = await prisma.recurringBillOccurrence.findMany({
      where: {
        tenantId,
        dueDate: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        },
        status: 'pending',
      },
      include: {
        recurringBill: {
          select: {
            type: true,
          },
        },
      },
    });

    console.log('[BALANCE-SUMMARY] Período:', startDate, 'até', endDate);
    console.log('[BALANCE-SUMMARY] Ocorrências pendentes encontradas:', pendingOccurrences.length);
    pendingOccurrences.forEach(occ => {
      console.log('  - ID:', occ.id, '| Vencimento:', occ.dueDate, '| Valor:', occ.amount, '| Tipo:', occ.recurringBill?.type);
    });

    // RECEITAS
    const receivedIncome = transactions
      .filter(t => t.type === 'income' && t.status === 'completed')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const pendingIncomeTransactions = transactions
      .filter(t => t.type === 'income' && t.status === 'pending')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const pendingIncomeOccurrences = pendingOccurrences
      .filter(occ => occ.recurringBill?.type === 'income')
      .reduce((sum, occ) => sum + Number(occ.amount), 0);

    const pendingIncome = pendingIncomeTransactions + pendingIncomeOccurrences;
    const totalIncome = receivedIncome + pendingIncome;

    // DESPESAS
    const paidExpense = transactions
      .filter(t => t.type === 'expense' && t.status === 'completed')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const pendingExpenseTransactions = transactions
      .filter(t => t.type === 'expense' && t.status === 'pending')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const pendingExpenseOccurrences = pendingOccurrences
      .filter(occ => occ.recurringBill?.type === 'expense')
      .reduce((sum, occ) => sum + Number(occ.amount), 0);

    const pendingExpense = pendingExpenseTransactions + pendingExpenseOccurrences;
    const totalExpense = paidExpense + pendingExpense;

    // SALDO
    const balance = totalIncome - totalExpense;
    const isPositive = balance >= 0;

    // Calcular saldo por mês
    const monthlyBalances: any = {};
    transactions.forEach(t => {
      const month = t.transactionDate.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyBalances[month]) {
        monthlyBalances[month] = { income: 0, expense: 0 };
      }
      if (t.type === 'income') {
        monthlyBalances[month].income += Number(t.amount);
      } else if (t.type === 'expense') {
        monthlyBalances[month].expense += Number(t.amount);
      }
    });

    const monthlyData = Object.entries(monthlyBalances).map(([month, data]: any) => ({
      month,
      income: data.income,
      expense: data.expense,
      balance: data.income - data.expense,
    }));

    // Calcular média mensal
    const avgMonthlyBalance = monthlyData.length > 0
      ? monthlyData.reduce((sum, m) => sum + m.balance, 0) / monthlyData.length
      : 0;

    const result = {
      period: {
        start: startDate,
        end: endDate,
      },
      summary: {
        // RECEITAS
        totalIncome: totalIncome,
        receivedIncome: receivedIncome,
        pendingIncome: pendingIncome,
        
        // DESPESAS
        totalExpense: totalExpense,
        paidExpense: paidExpense,
        pendingExpense: pendingExpense,
        
        // SALDO
        finalBalance: balance,
        isPositive,
        averageMonthlyBalance: avgMonthlyBalance,
      },
      monthlyBreakdown: monthlyData,
    };

    // Armazenar no cache
    await cacheService.set(CacheNamespace.DASHBOARD, cacheKey, result, CacheTTL.DASHBOARD);

    return successResponse(res, result);
  } catch (error) {
    log.error('Balance summary error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao calcular saldo', 500);
  }
});

// 2. Ranking de gastos (Pareto 80%)
router.get('/expense-ranking', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;
    const tenantId = req.tenantId!;

    if (!startDate || !endDate) {
      return errorResponse(res, 'VALIDATION_ERROR', 'startDate e endDate são obrigatórios', 400);
    }

    // Buscar despesas agrupadas por categoria
    const expenses = await prisma.transaction.findMany({
      where: {
        tenantId,
        type: 'expense',
        transactionDate: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        },
        status: 'completed',
        deletedAt: null,
      },
      select: {
        amount: true,
        categoryId: true,
      },
    });

    // Buscar categorias únicas apenas das transações encontradas
    const categoryIds = [...new Set(expenses.map(e => e.categoryId).filter(Boolean))];
    const categories = await prisma.category.findMany({
      where: {
        id: { in: categoryIds as string[] },
      },
      select: {
        id: true,
        name: true,
        parentId: true,
      },
    });

    // Criar mapa de categorias para acesso rápido
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    // Função para encontrar categoria raiz
    const getRootCategory = (categoryId: string | null): string | null => {
      if (!categoryId) return null;
      let current = categoryMap.get(categoryId);
      if (!current) return null;
      
      while (current.parentId) {
        const parent = categoryMap.get(current.parentId);
        if (!parent) break;
        current = parent;
      }
      return current.name;
    };

    // Agrupar por categoria principal (nível 1)
    const categoryTotals: any = {};
    let totalExpense = 0;

    expenses.forEach(transaction => {
      const amount = Number(transaction.amount);
      totalExpense += amount;

      const rootCategoryName = getRootCategory(transaction.categoryId);
      if (rootCategoryName) {
        if (!categoryTotals[rootCategoryName]) {
          categoryTotals[rootCategoryName] = {
            name: rootCategoryName,
            total: 0,
            count: 0,
          };
        }
        categoryTotals[rootCategoryName].total += amount;
        categoryTotals[rootCategoryName].count += 1;
      }
    });

    // Converter para array e ordenar por valor
    const ranking = Object.values(categoryTotals)
      .sort((a: any, b: any) => b.total - a.total)
      .map((cat: any, index) => ({
        rank: index + 1,
        name: cat.name,
        total: cat.total,
        count: cat.count,
        percentage: totalExpense > 0 ? (cat.total / totalExpense) * 100 : 0,
      }));

    // Calcular Pareto 80/20: 20% das categorias que mais impactam
    // Se tiver 10 categorias, mostra as 2 maiores (20%)
    // Mínimo de 1, máximo de 5 para não poluir
    const totalCategories = ranking.length;
    const pareto20Count = Math.max(1, Math.min(5, Math.ceil(totalCategories * 0.2)));
    
    let accumulated = 0;
    const pareto80 = ranking.slice(0, pareto20Count).map((item: any) => {
      accumulated += item.percentage;
      return {
        ...item,
        accumulatedPercentage: accumulated,
      };
    });

    return successResponse(res, {
      period: {
        start: startDate,
        end: endDate,
      },
      totalExpense,
      ranking,
      pareto80,
    });
  } catch (error) {
    log.error('Expense ranking error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao calcular ranking de gastos', 500);
  }
});

// 3. Ranking de receitas
router.get('/income-ranking', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;
    const tenantId = req.tenantId!;

    if (!startDate || !endDate) {
      return errorResponse(res, 'VALIDATION_ERROR', 'startDate e endDate são obrigatórios', 400);
    }

    const incomes = await prisma.transaction.findMany({
      where: {
        tenantId,
        type: 'income',
        transactionDate: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        },
        status: 'completed',
        deletedAt: null,
      },
      select: {
        amount: true,
        categoryId: true,
      },
    });

    // Buscar categorias únicas
    const categoryIds = [...new Set(incomes.map(e => e.categoryId).filter(Boolean))];
    const categories = await prisma.category.findMany({
      where: {
        id: { in: categoryIds as string[] },
      },
      select: {
        id: true,
        name: true,
        parentId: true,
      },
    });

    const categoryMap = new Map(categories.map(c => [c.id, c]));

    const getRootCategory = (categoryId: string | null): string | null => {
      if (!categoryId) return null;
      let current = categoryMap.get(categoryId);
      if (!current) return null;
      
      while (current.parentId) {
        const parent = categoryMap.get(current.parentId);
        if (!parent) break;
        current = parent;
      }
      return current.name;
    };

    const categoryTotals: any = {};
    let totalIncome = 0;

    incomes.forEach(transaction => {
      const amount = Number(transaction.amount);
      totalIncome += amount;

      const rootCategoryName = getRootCategory(transaction.categoryId);
      if (rootCategoryName) {
        if (!categoryTotals[rootCategoryName]) {
          categoryTotals[rootCategoryName] = {
            name: rootCategoryName,
            total: 0,
            count: 0,
          };
        }
        categoryTotals[rootCategoryName].total += amount;
        categoryTotals[rootCategoryName].count += 1;
      }
    });

    const ranking = Object.values(categoryTotals)
      .sort((a: any, b: any) => b.total - a.total)
      .map((cat: any, index) => ({
        rank: index + 1,
        name: cat.name,
        total: cat.total,
        count: cat.count,
        percentage: totalIncome > 0 ? (cat.total / totalIncome) * 100 : 0,
      }));

    return successResponse(res, {
      period: {
        start: startDate,
        end: endDate,
      },
      totalIncome,
      ranking,
    });
  } catch (error) {
    log.error('Income ranking error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao calcular ranking de receitas', 500);
  }
});

// 4. Gráfico de receitas x despesas com projeções
router.get('/income-vs-expenses', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;
    const tenantId = req.tenantId!;

    if (!startDate || !endDate) {
      return errorResponse(res, 'VALIDATION_ERROR', 'startDate e endDate são obrigatórios', 400);
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    // Transações realizadas
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        transactionDate: {
          gte: start,
          lte: end,
        },
        type: { in: ['income', 'expense'] },
        deletedAt: null,
      },
    });

    // Contas fixas (recorrentes) para projeção
    const recurringBills = await prisma.recurringBill.findMany({
      where: {
        tenantId,
        status: 'active',
        deletedAt: null,
      },
    });

    // Parcelas futuras
    const installments = await prisma.installment.findMany({
      where: {
        tenantId,
        dueDate: {
          gte: start,
          lte: end,
        },
        status: { in: ['pending', 'paid'] },
      },
    });

    // Agrupar por mês
    const monthlyData: any = {};
    
    // Criar todos os meses do período para garantir que apareçam no gráfico
    const startMonth = new Date(start);
    const endMonth = new Date(end);
    let currentDate = new Date(startMonth);
    
    while (currentDate <= endMonth) {
      const month = currentDate.toISOString().substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          realizedIncome: 0,
          realizedExpense: 0,
          projectedIncome: 0,
          projectedExpense: 0,
        };
      }
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    // Adicionar transações realizadas
    transactions.forEach(t => {
      const month = t.transactionDate.toISOString().substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          realizedIncome: 0,
          realizedExpense: 0,
          projectedIncome: 0,
          projectedExpense: 0,
        };
      }
      const amount = Number(t.amount);
      if (t.type === 'income') {
        monthlyData[month].realizedIncome += amount;
      } else if (t.type === 'expense') {
        monthlyData[month].realizedExpense += amount;
      }
    });

    // Adicionar parcelas ao mês correspondente
    installments.forEach((inst: any) => {
      const month = inst.dueDate.toISOString().substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          realizedIncome: 0,
          realizedExpense: 0,
          projectedIncome: 0,
          projectedExpense: 0,
        };
      }
      const amount = Number(inst.amount);
      if (inst.status === 'paid') {
        monthlyData[month].realizedExpense += amount;
      } else {
        monthlyData[month].projectedExpense += amount;
      }
    });

    // Adicionar contas fixas recorrentes (projeção)
    const currentMonth = new Date().toISOString().substring(0, 7);
    Object.keys(monthlyData).forEach(month => {
      if (month >= currentMonth) {
        recurringBills.forEach(bill => {
          if (bill.amount) {
            const amount = Number(bill.amount);
            if (bill.type === 'income') {
              monthlyData[month].projectedIncome = (monthlyData[month].projectedIncome || 0) + amount;
            } else if (bill.type === 'expense') {
              monthlyData[month].projectedExpense = (monthlyData[month].projectedExpense || 0) + amount;
            }
          }
        });
      }
    });

    // Converter para array ordenado
    const chartData = Object.values(monthlyData)
      .sort((a: any, b: any) => a.month.localeCompare(b.month))
      .map((data: any) => ({
        ...data,
        totalIncome: data.realizedIncome + (data.projectedIncome || 0),
        totalExpense: data.realizedExpense + data.projectedExpense,
        balance: (data.realizedIncome + (data.projectedIncome || 0)) - (data.realizedExpense + data.projectedExpense),
      }));

    return successResponse(res, {
      period: {
        start: startDate,
        end: endDate,
      },
      chartData,
      summary: {
        totalRealizedIncome: chartData.reduce((sum, d) => sum + d.realizedIncome, 0),
        totalRealizedExpense: chartData.reduce((sum, d) => sum + d.realizedExpense, 0),
        totalProjectedExpense: chartData.reduce((sum, d) => sum + d.projectedExpense, 0),
      },
    });
  } catch (error) {
    log.error('Income vs expenses error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao calcular receitas x despesas', 500);
  }
});

// Dashboard completo (todos os dados de uma vez)
router.get('/summary', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    
    // Período padrão: mês atual
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Cards de resumo
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        transactionDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        status: 'completed',
        deletedAt: null,
      },
    });

    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Contas bancárias
    const bankAccounts = await prisma.bankAccount.findMany({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
      },
    });

    const totalBalance = bankAccounts.reduce(
      (sum, acc) => sum + Number(acc.currentBalance),
      0
    );

    return successResponse(res, {
      currentMonth: {
        income,
        expense,
        balance: income - expense,
      },
      totalBalance,
      bankAccountsCount: bankAccounts.length,
      transactionsCount: transactions.length,
    });
  } catch (error) {
    log.error('Dashboard summary error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao carregar resumo', 500);
  }
});

// Novo: Insights inteligentes com gráficos
router.get('/insights', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // Buscar transações do mês atual e mês anterior
    const [currentMonthTransactions, lastMonthTransactions] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          tenantId,
          transactionDate: { gte: startOfMonth, lte: endOfMonth },
          type: { in: ['income', 'expense'] },
          deletedAt: null,
        },
      }),
      prisma.transaction.findMany({
        where: {
          tenantId,
          transactionDate: { gte: startOfLastMonth, lte: endOfLastMonth },
          type: { in: ['income', 'expense'] },
          deletedAt: null,
        },
      }),
    ]);

    // Calcular totais
    const currentIncome = currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const currentExpense = currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const lastIncome = lastMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const lastExpense = lastMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Calcular variações percentuais
    const incomeVariation = lastIncome > 0 ? ((currentIncome - lastIncome) / lastIncome) * 100 : 0;
    const expenseVariation = lastExpense > 0 ? ((currentExpense - lastExpense) / lastExpense) * 100 : 0;

    // Insight: Gastos por dia da semana
    const expensesByDayOfWeek = [0, 0, 0, 0, 0, 0, 0]; // Dom a Sáb
    currentMonthTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const day = new Date(t.transactionDate).getDay();
        expensesByDayOfWeek[day] += Number(t.amount);
      });

    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const mostExpensiveDay = expensesByDayOfWeek.indexOf(Math.max(...expensesByDayOfWeek));

    // Insight: Média diária de gastos
    const daysInMonth = endOfMonth.getDate();
    const avgDailyExpense = currentExpense / daysInMonth;
    const currentDay = today.getDate();
    const projectedExpense = avgDailyExpense * daysInMonth;

    // Insight: Comparação com mês anterior
    const savingsRate = currentIncome > 0 ? ((currentIncome - currentExpense) / currentIncome) * 100 : 0;
    const lastSavingsRate = lastIncome > 0 ? ((lastIncome - lastExpense) / lastIncome) * 100 : 0;

    return successResponse(res, {
      comparison: {
        income: {
          current: currentIncome,
          last: lastIncome,
          variation: incomeVariation,
        },
        expense: {
          current: currentExpense,
          last: lastExpense,
          variation: expenseVariation,
        },
        balance: {
          current: currentIncome - currentExpense,
          last: lastIncome - lastExpense,
        },
      },
      insights: [
        {
          type: 'day_analysis',
          title: `Você gasta mais às ${dayNames[mostExpensiveDay]}s`,
          description: `Neste mês, ${dayNames[mostExpensiveDay]} foi o dia com mais gastos: R$ ${expensesByDayOfWeek[mostExpensiveDay].toFixed(2)}`,
          icon: '📊',
        },
        {
          type: 'projection',
          title: 'Projeção para fim do mês',
          description: `Se manter o ritmo atual (R$ ${avgDailyExpense.toFixed(2)}/dia), gastará R$ ${projectedExpense.toFixed(2)} no mês`,
          icon: '🔮',
        },
        {
          type: 'savings',
          title: savingsRate >= lastSavingsRate ? '💰 Economia melhorou!' : '⚠️ Economia piorou',
          description: `Taxa de economia: ${savingsRate.toFixed(1)}% (mês passado: ${lastSavingsRate.toFixed(1)}%)`,
          icon: savingsRate >= lastSavingsRate ? '✅' : '⚠️',
        },
      ],
      charts: {
        expensesByDayOfWeek: dayNames.map((name, i) => ({
          day: name,
          amount: expensesByDayOfWeek[i],
        })),
      },
    });
  } catch (error: any) {
    log.error('Dashboard insights error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao carregar insights', 500);
  }
});

// Novo: Próximas contas a pagar (provisionamento)
router.get('/upcoming-bills', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const { days = '7' } = req.query;
    const daysAhead = parseInt(days as string);
    
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    // Buscar ocorrências pendentes
    const upcomingOccurrences = await prisma.recurringBillOccurrence.findMany({
      where: {
        tenantId,
        status: 'pending',
        dueDate: {
          gte: today,
          lte: futureDate,
        },
      },
      include: {
        recurringBill: {
          include: {
            category: true,
            bankAccount: true,
            paymentMethod: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    // Buscar parcelas pendentes
    const upcomingInstallments = await prisma.installment.findMany({
      where: {
        tenantId,
        status: 'pending',
        dueDate: {
          gte: today,
          lte: futureDate,
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    const totalAmount = 
      upcomingOccurrences.reduce((sum, o) => sum + Number(o.amount), 0) +
      upcomingInstallments.reduce((sum, i) => sum + Number(i.amount), 0);

    return successResponse(res, {
      period: {
        from: today,
        to: futureDate,
        days: daysAhead,
      },
      upcomingOccurrences: upcomingOccurrences.map(o => ({
        id: o.id,
        type: 'recurring',
        name: o.recurringBill.name,
        amount: o.amount,
        dueDate: o.dueDate,
        category: o.recurringBill.category?.name,
        bankAccount: o.recurringBill.bankAccount?.name,
        paymentMethod: o.recurringBill.paymentMethod?.name,
        daysUntilDue: Math.ceil((new Date(o.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      upcomingInstallments: upcomingInstallments.map(i => ({
        id: i.id,
        type: 'installment',
        name: `Parcela ${i.installmentNumber}`,
        amount: i.amount,
        dueDate: i.dueDate,
        installmentNumber: i.installmentNumber,
        totalInstallments: i.installmentNumber, // Usar como placeholder
        category: undefined,
        bankAccount: undefined,
        daysUntilDue: Math.ceil((new Date(i.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      summary: {
        totalBills: upcomingOccurrences.length + upcomingInstallments.length,
        totalAmount,
      },
    });
  } catch (error: any) {
    log.error('Upcoming bills error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao carregar próximas contas', 500);
  }
});

// 9. Resumo do DIA (receitas a receber hoje, despesas a pagar hoje, atrasadas)
router.get('/today-summary', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    
    // Data de hoje (início e fim do dia)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    // Data de ontem (para pegar atrasados)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // TRANSAÇÕES DO DIA (hoje)
    const todayTransactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        status: 'pending',
        transactionDate: {
          gte: today,
          lte: todayEnd,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        transactionDate: true,
        category: {
          select: { name: true, icon: true }
        },
      },
    });

    // OCORRÊNCIAS RECORRENTES DO DIA (hoje)
    const todayOccurrences = await prisma.recurringBillOccurrence.findMany({
      where: {
        tenantId,
        status: 'pending',
        dueDate: {
          gte: today,
          lte: todayEnd,
        },
      },
      include: {
        recurringBill: {
          select: {
            type: true,
            name: true,
            category: { select: { name: true, icon: true } },
          },
        },
      },
    });

    // TRANSAÇÕES ATRASADAS (status overdue OU (data < hoje e status pending))
    const overdueTransactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        type: 'expense',
        OR: [
          { status: 'overdue' },
          {
            status: 'pending',
            transactionDate: {
              lt: today,
            },
          },
        ],
        deletedAt: null,
      },
      select: {
        id: true,
        amount: true,
        description: true,
        transactionDate: true,
        dueDate: true,
        category: {
          select: { name: true, icon: true }
        },
      },
      orderBy: {
        transactionDate: 'asc',
      },
    });

    // OCORRÊNCIAS ATRASADAS (dueDate < hoje e status pending)
    const overdueOccurrences = await prisma.recurringBillOccurrence.findMany({
      where: {
        tenantId,
        status: 'pending',
        dueDate: {
          lt: today,
        },
        recurringBill: {
          type: 'expense',
        },
      },
      include: {
        recurringBill: {
          select: {
            name: true,
            category: { select: { name: true, icon: true } },
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    // Calcular totais do dia
    const todayIncomeTransactions = todayTransactions.filter(t => t.type === 'income');
    const todayExpenseTransactions = todayTransactions.filter(t => t.type === 'expense');
    const todayIncomeOccurrences = todayOccurrences.filter(o => o.recurringBill?.type === 'income');
    const todayExpenseOccurrences = todayOccurrences.filter(o => o.recurringBill?.type === 'expense');

    const incomeToReceiveToday = 
      todayIncomeTransactions.reduce((sum, t) => sum + Number(t.amount), 0) +
      todayIncomeOccurrences.reduce((sum, o) => sum + Number(o.amount), 0);

    const expenseToPayToday = 
      todayExpenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0) +
      todayExpenseOccurrences.reduce((sum, o) => sum + Number(o.amount), 0);

    const overdueTotal = 
      overdueTransactions.reduce((sum, t) => sum + Number(t.amount), 0) +
      overdueOccurrences.reduce((sum, o) => sum + Number(o.amount), 0);

    // Montar lista de receitas do dia
    const incomeItems = [
      ...todayIncomeTransactions.map(t => ({
        id: t.id,
        type: 'transaction' as const,
        description: t.description,
        amount: Number(t.amount),
        category: t.category?.name,
        icon: t.category?.icon,
      })),
      ...todayIncomeOccurrences.map(o => ({
        id: o.id,
        type: 'recurring' as const,
        description: o.recurringBill?.name || 'Conta Recorrente',
        amount: Number(o.amount),
        category: o.recurringBill?.category?.name,
        icon: o.recurringBill?.category?.icon,
      })),
    ];

    // Montar lista de despesas do dia
    const expenseItems = [
      ...todayExpenseTransactions.map(t => ({
        id: t.id,
        type: 'transaction' as const,
        description: t.description,
        amount: Number(t.amount),
        category: t.category?.name,
        icon: t.category?.icon,
      })),
      ...todayExpenseOccurrences.map(o => ({
        id: o.id,
        type: 'recurring' as const,
        description: o.recurringBill?.name || 'Conta Recorrente',
        amount: Number(o.amount),
        category: o.recurringBill?.category?.name,
        icon: o.recurringBill?.category?.icon,
      })),
    ];

    // Montar lista de atrasados
    const overdueItems = [
      ...overdueTransactions.map(t => ({
        id: t.id,
        type: 'transaction' as const,
        description: t.description,
        amount: Number(t.amount),
        dueDate: t.transactionDate,
        daysOverdue: Math.ceil((today.getTime() - new Date(t.transactionDate).getTime()) / (1000 * 60 * 60 * 24)),
        category: t.category?.name,
        icon: t.category?.icon,
      })),
      ...overdueOccurrences.map(o => ({
        id: o.id,
        type: 'recurring' as const,
        description: o.recurringBill?.name || 'Conta Recorrente',
        amount: Number(o.amount),
        dueDate: o.dueDate,
        daysOverdue: Math.ceil((today.getTime() - new Date(o.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
        category: o.recurringBill?.category?.name,
        icon: o.recurringBill?.category?.icon,
      })),
    ];

    return successResponse(res, {
      date: today.toISOString().split('T')[0],
      today: {
        incomeToReceive: {
          total: incomeToReceiveToday,
          count: incomeItems.length,
          items: incomeItems,
        },
        expenseToPay: {
          total: expenseToPayToday,
          count: expenseItems.length,
          items: expenseItems,
        },
      },
      overdue: {
        total: overdueTotal,
        count: overdueItems.length,
        items: overdueItems,
      },
    });
  } catch (error: any) {
    log.error('Today summary error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao carregar resumo do dia', 500);
  }
});

export default router;

