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

// ==================== PLANO DE CONTAS HIERÁRQUICO ====================
router.get('/hierarchical-categories', authenticateToken, async (req: AuthRequest, res: Response) => {
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

    // Buscar TODAS as categorias do tenant com hierarquia
    const allCategories = await prisma.category.findMany({
      where: { 
        tenantId,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
        type: true,
        parentId: true,
        level: true
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }]
    });

    // Buscar transações do período agrupadas por categoria
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        transactionDate: { gte: start, lte: end },
        status: 'completed',
        deletedAt: null
      },
      select: {
        categoryId: true,
        amount: true,
        type: true
      }
    });

    // Mapear totais por categoria
    const categoryTotals = new Map<string, { income: number; expense: number; count: number }>();
    
    transactions.forEach(t => {
      if (!t.categoryId) return;
      
      if (!categoryTotals.has(t.categoryId)) {
        categoryTotals.set(t.categoryId, { income: 0, expense: 0, count: 0 });
      }
      
      const data = categoryTotals.get(t.categoryId)!;
      if (t.type === 'INCOME') {
        data.income += Number(t.amount);
      } else {
        data.expense += Number(t.amount);
      }
      data.count++;
    });

    // Função para calcular totais recursivamente (incluindo filhos)
    const calculateTotalsWithChildren = (categoryId: string): { income: number; expense: number; count: number } => {
      const directTotals = categoryTotals.get(categoryId) || { income: 0, expense: 0, count: 0 };
      const children = allCategories.filter(c => c.parentId === categoryId);
      
      let totalIncome = directTotals.income;
      let totalExpense = directTotals.expense;
      let totalCount = directTotals.count;
      
      children.forEach(child => {
        const childTotals = calculateTotalsWithChildren(child.id);
        totalIncome += childTotals.income;
        totalExpense += childTotals.expense;
        totalCount += childTotals.count;
      });
      
      return { income: totalIncome, expense: totalExpense, count: totalCount };
    };

    // Construir árvore hierárquica
    interface HierarchicalCategory {
      id: string;
      name: string;
      icon: string | null;
      color: string | null;
      type: string;
      level: number;
      income: number;
      expense: number;
      totalWithChildren: { income: number; expense: number; count: number };
      transactionCount: number;
      children: HierarchicalCategory[];
    }

    const buildTree = (parentId: string | null, level: number): HierarchicalCategory[] => {
      return allCategories
        .filter(c => c.parentId === parentId && c.level === level)
        .map(cat => {
          const directTotals = categoryTotals.get(cat.id) || { income: 0, expense: 0, count: 0 };
          const totalWithChildren = calculateTotalsWithChildren(cat.id);
          
          return {
            id: cat.id,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            type: cat.type,
            level: cat.level || 1,
            income: directTotals.income,
            expense: directTotals.expense,
            totalWithChildren,
            transactionCount: directTotals.count,
            children: buildTree(cat.id, (cat.level || 1) + 1)
          };
        })
        .sort((a, b) => {
          // Ordenar por total (maior primeiro)
          const totalA = a.totalWithChildren.income + a.totalWithChildren.expense;
          const totalB = b.totalWithChildren.income + b.totalWithChildren.expense;
          return totalB - totalA;
        });
    };

    // Separar por tipo (INCOME e EXPENSE)
    const incomeCategories = buildTree(null, 1).filter(c => c.type === 'INCOME');
    const expenseCategories = buildTree(null, 1).filter(c => c.type === 'EXPENSE');

    // Calcular totais gerais
    let totalIncome = 0;
    let totalExpense = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') {
        totalIncome += Number(t.amount);
      } else {
        totalExpense += Number(t.amount);
      }
    });

    res.json({
      success: true,
      data: {
        income: {
          categories: incomeCategories,
          total: totalIncome
        },
        expense: {
          categories: expenseCategories,
          total: totalExpense
        },
        summary: {
          totalIncome,
          totalExpense,
          balance: totalIncome - totalExpense,
          transactionCount: transactions.length
        },
        period: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      }
    });
  } catch (error: any) {
    log.error('Erro ao gerar plano de contas hierárquico:', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Erro ao gerar plano de contas hierárquico' }
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

// ==================== DRE - DEMONSTRAÇÃO DE RESULTADO ====================
router.get('/dre', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { year, showExpected = 'true' } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
    const monthNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

    // Buscar TODAS as categorias do tenant com hierarquia
    const allCategories = await prisma.category.findMany({
      where: { 
        tenantId,
        deletedAt: null,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        icon: true,
        type: true,
        parentId: true,
        level: true
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }]
    });

    // Buscar transações do ano
    const startOfYear = new Date(targetYear, 0, 1);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        transactionDate: { gte: startOfYear, lte: endOfYear },
        deletedAt: null
      },
      select: {
        categoryId: true,
        amount: true,
        type: true,
        status: true,
        transactionDate: true
      }
    });

    // Buscar orçamentos para valores esperados
    const budgets = await prisma.budget.findMany({
      where: {
        tenantId,
        isActive: true
      },
      select: {
        categoryId: true,
        amount: true,
        period: true
      }
    });

    // Criar mapa de orçamentos mensais por categoria
    const budgetMap = new Map<string, number>();
    budgets.forEach(b => {
      if (!b.categoryId) return;
      let monthlyAmount = Number(b.amount);
      switch (b.period) {
        case 'quarterly': monthlyAmount = monthlyAmount / 3; break;
        case 'semester': monthlyAmount = monthlyAmount / 6; break;
        case 'annual': monthlyAmount = monthlyAmount / 12; break;
      }
      budgetMap.set(b.categoryId, (budgetMap.get(b.categoryId) || 0) + monthlyAmount);
    });

    // Mapear transações por categoria e mês
    type MonthData = { realizado: number; esperado: number };
    type CategoryMonthlyData = Map<number, MonthData>;
    const categoryMonthlyData = new Map<string, CategoryMonthlyData>();

    // Inicializar todas as categorias
    allCategories.forEach(cat => {
      const monthData = new Map<number, MonthData>();
      for (let m = 0; m < 12; m++) {
        monthData.set(m, { 
          realizado: 0, 
          esperado: budgetMap.get(cat.id) || 0 
        });
      }
      categoryMonthlyData.set(cat.id, monthData);
    });

    // Preencher com transações realizadas
    transactions.forEach(t => {
      if (!t.categoryId || t.status === 'cancelled') return;
      
      const month = new Date(t.transactionDate).getMonth();
      const catData = categoryMonthlyData.get(t.categoryId);
      if (catData) {
        const monthData = catData.get(month);
        if (monthData) {
          monthData.realizado += Number(t.amount);
        }
      }
    });

    // Função para calcular totais recursivamente (incluindo filhos)
    const calculateTotalsWithChildren = (categoryId: string, month: number): MonthData => {
      const directData = categoryMonthlyData.get(categoryId)?.get(month) || { realizado: 0, esperado: 0 };
      const children = allCategories.filter(c => c.parentId === categoryId);
      
      let totalRealizado = directData.realizado;
      let totalEsperado = directData.esperado;
      
      children.forEach(child => {
        const childTotals = calculateTotalsWithChildren(child.id, month);
        totalRealizado += childTotals.realizado;
        totalEsperado += childTotals.esperado;
      });
      
      return { realizado: totalRealizado, esperado: totalEsperado };
    };

    // Interface para linha do DRE
    interface DRERow {
      id: string;
      name: string;
      icon: string | null;
      type: string;
      level: number;
      isGroup: boolean;
      isCalculated: boolean;
      months: {
        [key: string]: {
          esperado: number;
          realizado: number;
          av: number; // Análise Vertical (% do total)
          ah: number; // Análise Horizontal (% variação vs mês anterior)
        };
      };
      totalYear: {
        esperado: number;
        realizado: number;
        av: number;
      };
      children: DRERow[];
    }

    // Construir árvore hierárquica para DRE
    const buildDRETree = (parentId: string | null, level: number, filterType?: string): DRERow[] => {
      let cats = allCategories.filter(c => {
        // Para level 1, buscar categorias sem parent (null, undefined, ou '')
        if (parentId === null) {
          return (!c.parentId || c.parentId === null || c.parentId === '') && c.level === level;
        }
        return c.parentId === parentId && c.level === level;
      });
      if (filterType) {
        cats = cats.filter(c => c.type === filterType);
      }

      return cats.map(cat => {
        const months: DRERow['months'] = {};
        let totalYearRealizado = 0;
        let totalYearEsperado = 0;

        for (let m = 0; m < 12; m++) {
          const totals = calculateTotalsWithChildren(cat.id, m);
          months[monthNames[m]] = {
            esperado: totals.esperado,
            realizado: totals.realizado,
            av: 0, // Será calculado depois
            ah: 0  // Será calculado depois
          };
          totalYearRealizado += totals.realizado;
          totalYearEsperado += totals.esperado;
        }

        return {
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          type: cat.type,
          level: cat.level || 1,
          isGroup: allCategories.some(c => c.parentId === cat.id),
          isCalculated: false,
          months,
          totalYear: {
            esperado: totalYearEsperado,
            realizado: totalYearRealizado,
            av: 0
          },
          children: buildDRETree(cat.id, (cat.level || 1) + 1)
        };
      }).sort((a, b) => b.totalYear.realizado - a.totalYear.realizado);
    };

    // Separar receitas e despesas (lowercase - como está no banco)
    const receitaCategories = buildDRETree(null, 1, 'income');
    const despesaCategories = buildDRETree(null, 1, 'expense');

    // Calcular totais gerais por mês
    const totaisMensais = {
      receitas: {} as { [key: string]: { esperado: number; realizado: number } },
      despesas: {} as { [key: string]: { esperado: number; realizado: number } },
      lucro: {} as { [key: string]: { esperado: number; realizado: number } }
    };

    for (let m = 0; m < 12; m++) {
      let receitaEsperado = 0, receitaRealizado = 0;
      let despesaEsperado = 0, despesaRealizado = 0;

      receitaCategories.forEach(cat => {
        receitaEsperado += cat.months[monthNames[m]].esperado;
        receitaRealizado += cat.months[monthNames[m]].realizado;
      });

      despesaCategories.forEach(cat => {
        despesaEsperado += cat.months[monthNames[m]].esperado;
        despesaRealizado += cat.months[monthNames[m]].realizado;
      });

      totaisMensais.receitas[monthNames[m]] = { esperado: receitaEsperado, realizado: receitaRealizado };
      totaisMensais.despesas[monthNames[m]] = { esperado: despesaEsperado, realizado: despesaRealizado };
      totaisMensais.lucro[monthNames[m]] = { 
        esperado: receitaEsperado - despesaEsperado, 
        realizado: receitaRealizado - despesaRealizado 
      };
    }

    // Calcular AV% (Análise Vertical - % do total do mês)
    const calculateAV = (rows: DRERow[], totalKey: 'receitas' | 'despesas') => {
      rows.forEach(row => {
        Object.keys(row.months).forEach(month => {
          const totalMes = totaisMensais[totalKey][month]?.realizado || 1;
          row.months[month].av = totalMes > 0 
            ? Math.round((row.months[month].realizado / totalMes) * 10000) / 100 
            : 0;
        });
        
        const totalYearForType = rows.reduce((sum, r) => sum + r.totalYear.realizado, 0) || 1;
        row.totalYear.av = Math.round((row.totalYear.realizado / totalYearForType) * 10000) / 100;

        if (row.children.length > 0) {
          calculateAV(row.children, totalKey);
        }
      });
    };

    // Calcular AH% (Análise Horizontal - % variação vs mês anterior)
    const calculateAH = (rows: DRERow[]) => {
      rows.forEach(row => {
        let previousValue = 0;
        monthNames.forEach((month, index) => {
          const currentValue = row.months[month].realizado;
          if (index === 0) {
            row.months[month].ah = 0;
          } else {
            row.months[month].ah = previousValue > 0 
              ? Math.round(((currentValue - previousValue) / previousValue) * 10000) / 100 
              : 0;
          }
          previousValue = currentValue;
        });

        if (row.children.length > 0) {
          calculateAH(row.children);
        }
      });
    };

    calculateAV(receitaCategories, 'receitas');
    calculateAV(despesaCategories, 'despesas');
    calculateAH(receitaCategories);
    calculateAH(despesaCategories);

    // Calcular totais anuais
    const totalAnoReceitas = {
      esperado: Object.values(totaisMensais.receitas).reduce((sum, m) => sum + m.esperado, 0),
      realizado: Object.values(totaisMensais.receitas).reduce((sum, m) => sum + m.realizado, 0)
    };

    const totalAnoDespesas = {
      esperado: Object.values(totaisMensais.despesas).reduce((sum, m) => sum + m.esperado, 0),
      realizado: Object.values(totaisMensais.despesas).reduce((sum, m) => sum + m.realizado, 0)
    };

    const totalAnoLucro = {
      esperado: totalAnoReceitas.esperado - totalAnoDespesas.esperado,
      realizado: totalAnoReceitas.realizado - totalAnoDespesas.realizado
    };

    // Linhas calculadas (como na imagem)
    const linhasCalculadas = {
      RECEITA_FATURAMENTO: {
        name: '📈 RECEITA/FATURAMENTO',
        months: totaisMensais.receitas,
        totalYear: totalAnoReceitas
      },
      CUSTOS_VARIAVEIS: {
        name: '📊 CUSTOS VARIÁVEIS',
        months: {} as { [key: string]: { esperado: number; realizado: number } },
        totalYear: { esperado: 0, realizado: 0 }
      },
      MARGEM_CONTRIBUICAO: {
        name: '💰 MARGEM DE CONTRIBUIÇÃO',
        months: {} as { [key: string]: { esperado: number; realizado: number } },
        totalYear: { esperado: 0, realizado: 0 }
      },
      DESPESAS_FIXAS: {
        name: '📋 DESPESAS FIXAS',
        months: {} as { [key: string]: { esperado: number; realizado: number } },
        totalYear: { esperado: 0, realizado: 0 }
      },
      LUCRO_OPERACIONAL: {
        name: '🎯 LUCRO OPERACIONAL',
        months: totaisMensais.lucro,
        totalYear: totalAnoLucro
      },
      RESULTADO_LIQUIDO: {
        name: '✅ RESULTADO LÍQUIDO',
        months: totaisMensais.lucro,
        totalYear: totalAnoLucro
      }
    };

    // Separar custos variáveis e fixos
    for (let m = 0; m < 12; m++) {
      let custosVariaveis = 0;
      let despesasFixas = 0;

      despesaCategories.forEach(cat => {
        // Simplificação: considerar todas como variáveis por enquanto
        // Depois pode-se adicionar flag isFixed nas categorias
        custosVariaveis += cat.months[monthNames[m]].realizado;
      });

      linhasCalculadas.CUSTOS_VARIAVEIS.months[monthNames[m]] = { 
        esperado: 0, 
        realizado: custosVariaveis 
      };

      linhasCalculadas.MARGEM_CONTRIBUICAO.months[monthNames[m]] = {
        esperado: totaisMensais.receitas[monthNames[m]].esperado - linhasCalculadas.CUSTOS_VARIAVEIS.months[monthNames[m]].esperado,
        realizado: totaisMensais.receitas[monthNames[m]].realizado - linhasCalculadas.CUSTOS_VARIAVEIS.months[monthNames[m]].realizado
      };
    }

    // Calcular totais anuais das linhas calculadas
    linhasCalculadas.CUSTOS_VARIAVEIS.totalYear = {
      esperado: Object.values(linhasCalculadas.CUSTOS_VARIAVEIS.months).reduce((s, m) => s + m.esperado, 0),
      realizado: Object.values(linhasCalculadas.CUSTOS_VARIAVEIS.months).reduce((s, m) => s + m.realizado, 0)
    };

    linhasCalculadas.MARGEM_CONTRIBUICAO.totalYear = {
      esperado: Object.values(linhasCalculadas.MARGEM_CONTRIBUICAO.months).reduce((s, m) => s + m.esperado, 0),
      realizado: Object.values(linhasCalculadas.MARGEM_CONTRIBUICAO.months).reduce((s, m) => s + m.realizado, 0)
    };

    res.json({
      success: true,
      data: {
        year: targetYear,
        months: monthNames,
        receitas: {
          categories: receitaCategories,
          total: totalAnoReceitas,
          monthly: totaisMensais.receitas
        },
        despesas: {
          categories: despesaCategories,
          total: totalAnoDespesas,
          monthly: totaisMensais.despesas
        },
        linhasCalculadas,
        summary: {
          totalReceitas: totalAnoReceitas.realizado,
          totalDespesas: totalAnoDespesas.realizado,
          lucroOperacional: totalAnoLucro.realizado,
          margemLucro: totalAnoReceitas.realizado > 0 
            ? Math.round((totalAnoLucro.realizado / totalAnoReceitas.realizado) * 10000) / 100 
            : 0
        }
      }
    });
  } catch (error: any) {
    log.error('Erro ao gerar DRE:', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Erro ao gerar DRE' }
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

// ==================== ENERGIA FINANCEIRA ====================
// Rotas cognitivas para análise de energia financeira

import energyReportsService from '../services/energy-reports.service';

/**
 * GET /api/v1/reports/energy-flow
 * Retorna distribuição de energia por período
 */
router.get('/energy-flow', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { startDate, endDate, groupBy = 'month', period } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    let start: Date;
    let end = endDate ? new Date(endDate as string) : new Date();

    // Se period foi passado, calcular datas baseado nele
    if (period) {
      const now = new Date();
      end = now;
      switch (period) {
        case '1m':
          start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case '3m':
          start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
          break;
        case '6m':
          start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
          break;
        case '12m':
          start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        case 'ytd':
          start = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      }
    } else {
      start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
    }

    if (groupBy === 'single') {
      const energy = await energyReportsService.getEnergyDistribution(tenantId, start, end);
      return res.json({ success: true, data: energy });
    }

    const timeline = await energyReportsService.getEnergyTimeline(
      tenantId, 
      start, 
      end, 
      groupBy as 'month' | 'week' | 'day'
    );

    return res.json({ success: true, data: timeline });
  } catch (error) {
    log.error('Error in energy-flow:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao calcular fluxo de energia' }
    });
  }
});

/**
 * GET /api/v1/reports/health-index
 * Retorna índice de saúde financeira
 */
router.get('/health-index', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { period = '3m' } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const end = new Date();
    let start: Date;

    switch (period) {
      case '1m':
        start = new Date(end.getFullYear(), end.getMonth() - 1, 1);
        break;
      case '3m':
        start = new Date(end.getFullYear(), end.getMonth() - 3, 1);
        break;
      case '6m':
        start = new Date(end.getFullYear(), end.getMonth() - 6, 1);
        break;
      case '12m':
        start = new Date(end.getFullYear() - 1, end.getMonth(), 1);
        break;
      case 'ytd':
        start = new Date(end.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(end.getFullYear(), end.getMonth() - 3, 1);
    }

    const healthIndex = await energyReportsService.getHealthIndex(tenantId, start, end);

    return res.json({ success: true, data: healthIndex });
  } catch (error) {
    log.error('Error in health-index:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao calcular índice de saúde' }
    });
  }
});

/**
 * GET /api/v1/reports/insights
 * Retorna insights e recomendações
 */
router.get('/insights', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { startDate, endDate, limit = '10' } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    const insights = await energyReportsService.generateInsights(tenantId, start, end);

    return res.json({ 
      success: true, 
      data: insights.slice(0, parseInt(limit as string))
    });
  } catch (error) {
    log.error('Error in insights:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao gerar insights' }
    });
  }
});

/**
 * GET /api/v1/reports/annual-narrative/:year
 * Retorna narrativa completa do ano
 */
router.get('/annual-narrative/:year', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const year = parseInt(req.params.year);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        error: { message: 'Ano inválido' }
      });
    }

    const narrative = await energyReportsService.generateAnnualNarrative(tenantId, year);

    return res.json({ success: true, data: narrative });
  } catch (error) {
    log.error('Error in annual-narrative:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao gerar narrativa anual' }
    });
  }
});

/**
 * GET /api/v1/reports/comparison
 * Compara dois períodos
 */
router.get('/comparison', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { 
      baseStart, baseEnd, 
      targetStart, targetEnd,
      preset 
    } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    let base: { start: Date; end: Date };
    let target: { start: Date; end: Date };

    if (preset) {
      const now = new Date();
      
      switch (preset) {
        case 'month-vs-previous':
          target = {
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
          };
          base = {
            start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            end: new Date(now.getFullYear(), now.getMonth(), 0)
          };
          break;
          
        case 'month-vs-year-ago':
          target = {
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
          };
          base = {
            start: new Date(now.getFullYear() - 1, now.getMonth(), 1),
            end: new Date(now.getFullYear() - 1, now.getMonth() + 1, 0)
          };
          break;
          
        case 'quarter-vs-previous':
          const currentQuarter = Math.floor(now.getMonth() / 3);
          target = {
            start: new Date(now.getFullYear(), currentQuarter * 3, 1),
            end: new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0)
          };
          base = {
            start: new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1),
            end: new Date(now.getFullYear(), currentQuarter * 3, 0)
          };
          break;
          
        case 'year-vs-previous':
          target = {
            start: new Date(now.getFullYear(), 0, 1),
            end: now
          };
          base = {
            start: new Date(now.getFullYear() - 1, 0, 1),
            end: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
          };
          break;
          
        default:
          return res.status(400).json({
            success: false,
            error: { message: 'Preset inválido' }
          });
      }
    } else {
      if (!baseStart || !baseEnd || !targetStart || !targetEnd) {
        return res.status(400).json({
          success: false,
          error: { message: 'Datas de comparação são obrigatórias' }
        });
      }
      
      base = {
        start: new Date(baseStart as string),
        end: new Date(baseEnd as string)
      };
      target = {
        start: new Date(targetStart as string),
        end: new Date(targetEnd as string)
      };
    }

    const comparison = await energyReportsService.comparePeriods(
      tenantId,
      base.start,
      base.end,
      target.start,
      target.end
    );

    return res.json({ success: true, data: comparison });
  } catch (error) {
    log.error('Error in comparison:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao comparar períodos' }
    });
  }
});

/**
 * GET /api/v1/reports/category-semantics
 * Retorna mapeamento semântico de todas as categorias
 */
router.get('/category-semantics', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const semantics = await energyReportsService.getCategorySemantics(tenantId);

    return res.json({ success: true, data: semantics });
  } catch (error) {
    log.error('Error in category-semantics:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao buscar semânticas' }
    });
  }
});

/**
 * PUT /api/v1/reports/category-semantics/:categoryId
 * Atualiza pesos semânticos de uma categoria
 */
router.put('/category-semantics/:categoryId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { categoryId } = req.params;
    const { survival, choice, future, loss } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    if (typeof survival !== 'number' || typeof choice !== 'number' || 
        typeof future !== 'number' || typeof loss !== 'number') {
      return res.status(400).json({
        success: false,
        error: { message: 'Pesos devem ser números' }
      });
    }

    const normalized = await energyReportsService.updateCategorySemantics(
      tenantId,
      categoryId,
      { survival, choice, future, loss }
    );

    return res.json({ 
      success: true, 
      message: 'Semântica atualizada',
      data: normalized
    });
  } catch (error) {
    log.error('Error updating category-semantics:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Erro ao atualizar semântica' }
    });
  }
});

export default router;
