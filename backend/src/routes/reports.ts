import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { log } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// ==================== FLUXO DE CAIXA ====================
router.get('/cash-flow', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { startDate, endDate, groupBy = 'month' } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Buscar todas as transações do período
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        transactionDate: { gte: start, lte: end },
        status: 'completed',
        deletedAt: null
      },
      orderBy: { transactionDate: 'asc' }
    });

    // Calcular totais
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const netCashFlow = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (netCashFlow / totalIncome) * 100 : 0;

    // Agrupar por período
    const timelineMap = new Map<string, { income: number; expense: number }>();
    
    transactions.forEach(t => {
      const date = new Date(t.transactionDate);
      let key: string;
      
      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const week = Math.ceil((date.getDate() - date.getDay() + 1) / 7);
        key = `${date.getFullYear()}-W${week}`;
      } else { // month
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!timelineMap.has(key)) {
        timelineMap.set(key, { income: 0, expense: 0 });
      }

      const data = timelineMap.get(key)!;
      if (t.type === 'income') {
        data.income += Number(t.amount);
      } else if (t.type === 'expense') {
        data.expense += Number(t.amount);
      }
    });

    const timeline = Array.from(timelineMap.entries()).map(([date, data]) => ({
      date,
      income: data.income,
      expense: data.expense,
      balance: data.income - data.expense
    }));

    // Buscar contas recorrentes para projeção
    const recurringBills = await prisma.recurringBill.findMany({
      where: {
        tenantId,
        deletedAt: null
      }
    });

    // Projeção simples para os próximos 3 meses
    const projection = [];
    const lastMonth = new Date(end);
    for (let i = 1; i <= 3; i++) {
      const projDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + i, 1);
      const key = `${projDate.getFullYear()}-${String(projDate.getMonth() + 1).padStart(2, '0')}`;
      
      let projectedIncome = 0;
      let projectedExpense = 0;

      recurringBills.forEach(bill => {
        if (bill.type === 'income') {
          projectedIncome += Number(bill.amount);
        } else {
          projectedExpense += Number(bill.amount);
        }
      });

      projection.push({
        date: key,
        projectedIncome,
        projectedExpense,
        projectedBalance: projectedIncome - projectedExpense
      });
    }

    res.json({
      success: true,
      data: {
        period: { start, end },
        summary: {
          totalIncome,
          totalExpense,
          netCashFlow,
          savingsRate: Math.round(savingsRate * 100) / 100
        },
        timeline,
        projection
      }
    });
  } catch (error: any) {
    log.error('Erro ao gerar fluxo de caixa:', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Erro ao gerar fluxo de caixa' }
    });
  }
});

// ==================== ANÁLISE POR CATEGORIA ====================
router.get('/category-analysis', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { startDate, endDate, type = 'expense' } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Buscar transações agrupadas por categoria
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        type: type as string,
        transactionDate: { gte: start, lte: end },
        status: 'completed',
        deletedAt: null
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
            type: true
          }
        }
      }
    });

    // Buscar orçamentos para comparação
    const budgets = await prisma.budget.findMany({
      where: {
        tenantId,
        isActive: true
      }
    });

    // Agrupar por categoria
    const categoryMap = new Map<string, {
      category: any;
      total: number;
      count: number;
      budget?: number;
    }>();

    transactions.forEach(t => {
      if (!t.category) return;

      const catId = t.category.id;
      if (!categoryMap.has(catId)) {
        const budget = budgets.find(b => b.categoryId === catId);
        categoryMap.set(catId, {
          category: t.category,
          total: 0,
          count: 0,
          budget: budget ? Number(budget.amount) : undefined
        });
      }

      const data = categoryMap.get(catId)!;
      data.total += Number(t.amount);
      data.count++;
    });

    const totalAmount = Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.total, 0);

    const categories = Array.from(categoryMap.values())
      .map(cat => ({
        id: cat.category.id,
        name: cat.category.name,
        icon: cat.category.icon,
        color: cat.category.color,
        total: cat.total,
        percentage: totalAmount > 0 ? (cat.total / totalAmount) * 100 : 0,
        transactionCount: cat.count,
        avgPerTransaction: cat.count > 0 ? cat.total / cat.count : 0,
        budget: cat.budget,
        budgetUsed: cat.budget ? (cat.total / cat.budget) * 100 : undefined
      }))
      .sort((a, b) => b.total - a.total);

    res.json({
      success: true,
      data: {
        categories,
        summary: {
          totalExpense: totalAmount,
          categoryCount: categories.length,
          avgPerCategory: categories.length > 0 ? totalAmount / categories.length : 0
        }
      }
    });
  } catch (error: any) {
    log.error('Erro ao gerar análise por categoria:', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Erro ao gerar análise por categoria' }
    });
  }
});

// ==================== ANÁLISE POR MEIO DE PAGAMENTO ====================
router.get('/payment-methods', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { startDate, endDate } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        transactionDate: { gte: start, lte: end },
        status: 'completed',
        deletedAt: null
      },
      include: {
        paymentMethod: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    const methodMap = new Map<string, { method: any; total: number; count: number }>();

    transactions.forEach(t => {
      const key = t.paymentMethod ? t.paymentMethod.id : 'no-method';
      const methodName = t.paymentMethod ? t.paymentMethod.name : 'Sem meio de pagamento';
      const methodType = t.paymentMethod ? t.paymentMethod.type : 'other';

      if (!methodMap.has(key)) {
        methodMap.set(key, {
          method: { id: key, name: methodName, type: methodType },
          total: 0,
          count: 0
        });
      }

      const data = methodMap.get(key)!;
      data.total += Number(t.amount);
      data.count++;
    });

    const totalAmount = Array.from(methodMap.values()).reduce((sum, m) => sum + m.total, 0);

    const paymentMethods = Array.from(methodMap.values())
      .map(m => ({
        id: m.method.id,
        name: m.method.name,
        type: m.method.type,
        total: m.total,
        percentage: totalAmount > 0 ? (m.total / totalAmount) * 100 : 0,
        transactionCount: m.count,
        avgPerTransaction: m.count > 0 ? m.total / m.count : 0
      }))
      .sort((a, b) => b.total - a.total);

    res.json({
      success: true,
      data: {
        paymentMethods,
        summary: {
          totalAmount,
          methodCount: paymentMethods.length
        }
      }
    });
  } catch (error: any) {
    log.error('Erro ao gerar análise por meio de pagamento:', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Erro ao gerar análise por meio de pagamento' }
    });
  }
});

// ==================== RECEITAS VS DESPESAS ====================
router.get('/income-vs-expense', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { startDate, endDate, groupBy = 'month' } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        transactionDate: { gte: start, lte: end },
        status: 'completed',
        deletedAt: null
      },
      orderBy: { transactionDate: 'asc' }
    });

    // Agrupar por período
    const periodMap = new Map<string, { income: number; expense: number }>();

    transactions.forEach(t => {
      const date = new Date(t.transactionDate);
      let key: string;

      if (groupBy === 'quarter') {
        const quarter = Math.ceil((date.getMonth() + 1) / 3);
        key = `${date.getFullYear()}-Q${quarter}`;
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!periodMap.has(key)) {
        periodMap.set(key, { income: 0, expense: 0 });
      }

      const data = periodMap.get(key)!;
      if (t.type === 'income') {
        data.income += Number(t.amount);
      } else if (t.type === 'expense') {
        data.expense += Number(t.amount);
      }
    });

    const comparison = Array.from(periodMap.entries()).map(([period, data]) => ({
      period,
      income: data.income,
      expense: data.expense,
      balance: data.income - data.expense,
      savingsRate: data.income > 0 ? ((data.income - data.expense) / data.income) * 100 : 0
    }));

    // Calcular totais
    const totalIncome = comparison.reduce((sum, p) => sum + p.income, 0);
    const totalExpense = comparison.reduce((sum, p) => sum + p.expense, 0);
    const avgSavingsRate = comparison.length > 0
      ? comparison.reduce((sum, p) => sum + p.savingsRate, 0) / comparison.length
      : 0;

    res.json({
      success: true,
      data: {
        comparison,
        summary: {
          totalIncome,
          totalExpense,
          totalBalance: totalIncome - totalExpense,
          avgSavingsRate: Math.round(avgSavingsRate * 100) / 100,
          periodCount: comparison.length
        }
      }
    });
  } catch (error: any) {
    log.error('Erro ao gerar comparação receitas vs despesas:', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Erro ao gerar comparação' }
    });
  }
});

// ==================== ANÁLISE DE TENDÊNCIAS ====================
router.get('/trends', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { startDate, endDate, categoryId } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear() - 1, 0, 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    const where: any = {
      tenantId,
      transactionDate: { gte: start, lte: end },
      status: 'completed',
      deletedAt: null
    };

    if (categoryId) {
      where.categoryId = categoryId as string;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, icon: true }
        }
      },
      orderBy: { transactionDate: 'asc' }
    });

    // Agrupar por mês
    const monthlyMap = new Map<string, { income: number; expense: number; transactions: number }>();

    transactions.forEach(t => {
      const date = new Date(t.transactionDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { income: 0, expense: 0, transactions: 0 });
      }

      const data = monthlyMap.get(key)!;
      data.transactions++;
      if (t.type === 'income') {
        data.income += Number(t.amount);
      } else if (t.type === 'expense') {
        data.expense += Number(t.amount);
      }
    });

    const monthlyData = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      income: data.income,
      expense: data.expense,
      balance: data.income - data.expense,
      transactions: data.transactions
    }));

    // Calcular tendências
    const expenseValues = monthlyData.map(d => d.expense);
    const avgExpense = expenseValues.reduce((sum, val) => sum + val, 0) / expenseValues.length;
    
    // Crescimento médio (simplificado)
    let growthRate = 0;
    if (expenseValues.length >= 2) {
      const first = expenseValues[0];
      const last = expenseValues[expenseValues.length - 1];
      growthRate = first > 0 ? ((last - first) / first) * 100 : 0;
    }

    // Identificar outliers (gastos anormais)
    const stdDev = Math.sqrt(
      expenseValues.reduce((sum, val) => sum + Math.pow(val - avgExpense, 2), 0) / expenseValues.length
    );
    
    const outliers = monthlyData.filter(d => 
      Math.abs(d.expense - avgExpense) > stdDev * 2
    );

    res.json({
      success: true,
      data: {
        monthlyData,
        insights: {
          avgExpense: Math.round(avgExpense * 100) / 100,
          growthRate: Math.round(growthRate * 100) / 100,
          trend: growthRate > 5 ? 'increasing' : growthRate < -5 ? 'decreasing' : 'stable',
          outliers: outliers.map(o => ({
            month: o.month,
            expense: o.expense,
            deviation: Math.round(((o.expense - avgExpense) / avgExpense) * 100 * 100) / 100
          }))
        }
      }
    });
  } catch (error: any) {
    log.error('Erro ao gerar análise de tendências:', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Erro ao gerar análise de tendências' }
    });
  }
});

// ==================== RESUMO DE ORÇAMENTOS ====================
router.get('/budgets-summary', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { startDate, endDate } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const budgets = await prisma.budget.findMany({
      where: {
        tenantId,
        isActive: true
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true
          }
        }
      }
    });

    const budgetsWithProgress = await Promise.all(
      budgets.map(async (budget) => {
        const now = new Date();
        let start = budget.startDate;
        let end = budget.endDate;

        // Calcular período atual baseado no tipo
        switch (budget.period) {
          case 'monthly':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            break;
          case 'quarterly':
            const quarter = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), quarter * 3, 1);
            end = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
            break;
          case 'semester':
            const semester = now.getMonth() < 6 ? 0 : 1;
            start = new Date(now.getFullYear(), semester * 6, 1);
            end = new Date(now.getFullYear(), (semester + 1) * 6, 0, 23, 59, 59);
            break;
          case 'annual':
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            break;
        }

        const transactions = await prisma.transaction.findMany({
          where: {
            tenantId,
            categoryId: budget.categoryId,
            transactionDate: { gte: start, lte: end },
            type: 'expense',
            status: 'completed',
            deletedAt: null
          }
        });

        const spent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const percentage = (spent / Number(budget.amount)) * 100;

        return {
          id: budget.id,
          name: budget.name,
          category: budget.category,
          amount: Number(budget.amount),
          spent,
          remaining: Number(budget.amount) - spent,
          percentage: Math.round(percentage * 100) / 100,
          status: percentage >= 100 ? 'exceeded' : percentage >= 90 ? 'warning' : percentage >= 80 ? 'attention' : 'normal',
          period: budget.period
        };
      })
    );

    const summary = {
      total: budgetsWithProgress.length,
      exceeded: budgetsWithProgress.filter(b => b.status === 'exceeded').length,
      warning: budgetsWithProgress.filter(b => b.status === 'warning').length,
      attention: budgetsWithProgress.filter(b => b.status === 'attention').length,
      normal: budgetsWithProgress.filter(b => b.status === 'normal').length,
      totalBudgeted: budgetsWithProgress.reduce((sum, b) => sum + b.amount, 0),
      totalSpent: budgetsWithProgress.reduce((sum, b) => sum + b.spent, 0)
    };

    res.json({
      success: true,
      data: {
        budgets: budgetsWithProgress,
        summary
      }
    });
  } catch (error: any) {
    log.error('Erro ao gerar resumo de orçamentos:', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Erro ao gerar resumo de orçamentos' }
    });
  }
});

export default router;
