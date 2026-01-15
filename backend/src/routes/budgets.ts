import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { log } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// ==================== LISTAR ORÇAMENTOS ====================
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { categoryId, isActive, period, month, year } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const where: any = { tenantId };
    
    if (categoryId) where.categoryId = categoryId as string;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (period) where.period = period as string;

    // Filtro por mês/ano específico
    if (month && year) {
      const targetDate = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
      where.OR = [
        {
          AND: [
            { startDate: { lte: targetDate } },
            { endDate: { gte: targetDate } }
          ]
        }
      ];
    }

    const budgets = await prisma.budget.findMany({
      where,
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
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calcular gastos para cada orçamento (considerando renovação automática)
    const budgetsWithStats = await Promise.all(
      budgets.map(async (budget) => {
        const now = new Date();
        let startDate = budget.startDate;
        let endDate = budget.endDate;
        
        // Se tem filtro de mês/ano, usar esse período
        if (month && year) {
          const filterMonth = parseInt(month as string);
          const filterYear = parseInt(year as string);
          
          // Calcular período baseado no tipo
          switch (budget.period) {
            case 'monthly':
              startDate = new Date(filterYear, filterMonth - 1, 1);
              endDate = new Date(filterYear, filterMonth, 0, 23, 59, 59);
              break;
            case 'quarterly':
              const quarter = Math.ceil(filterMonth / 3);
              startDate = new Date(filterYear, (quarter - 1) * 3, 1);
              endDate = new Date(filterYear, quarter * 3, 0, 23, 59, 59);
              break;
            case 'semester':
              const semester = filterMonth <= 6 ? 1 : 2;
              startDate = new Date(filterYear, (semester - 1) * 6, 1);
              endDate = new Date(filterYear, semester * 6, 0, 23, 59, 59);
              break;
            case 'annual':
              startDate = new Date(filterYear, 0, 1);
              endDate = new Date(filterYear, 11, 31, 23, 59, 59);
              break;
          }
        } else {
          // Sem filtro: calcular período atual baseado na renovação
          const originalStart = new Date(budget.startDate);
          
          switch (budget.period) {
            case 'monthly':
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
              break;
            case 'quarterly':
              const currentQuarter = Math.floor(now.getMonth() / 3);
              startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
              endDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0, 23, 59, 59);
              break;
            case 'semester':
              const currentSemester = now.getMonth() < 6 ? 0 : 1;
              startDate = new Date(now.getFullYear(), currentSemester * 6, 1);
              endDate = new Date(now.getFullYear(), (currentSemester + 1) * 6, 0, 23, 59, 59);
              break;
            case 'annual':
              startDate = new Date(now.getFullYear(), 0, 1);
              endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
              break;
          }
        }

        const isCurrentPeriod = now >= startDate && now <= endDate;

        // Buscar transações da categoria no período calculado
        const transactions = await prisma.transaction.findMany({
          where: {
            tenantId,
            categoryId: budget.categoryId,
            transactionDate: {
              gte: startDate,
              lte: endDate
            },
            type: 'expense',
            status: 'completed',
            deletedAt: null
          }
        });

        const spent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const percentage = (spent / Number(budget.amount)) * 100;
        const remaining = Number(budget.amount) - spent;

        return {
          ...budget,
          amount: Number(budget.amount),
          spent,
          percentage: Math.round(percentage * 100) / 100,
          remaining,
          currentStartDate: startDate,
          currentEndDate: endDate,
          isCurrentPeriod,
          status: percentage >= 100 ? 'exceeded' : percentage >= 90 ? 'warning' : 'normal'
        };
      })
    );

    res.json({
      success: true,
      data: budgetsWithStats
    });
  } catch (error: any) {
    log.error('Erro ao listar orçamentos:', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Erro ao listar orçamentos' }
    });
  }
});

// ==================== BUSCAR ORÇAMENTO POR ID ====================
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const budget = await prisma.budget.findFirst({
      where: { id, tenantId },
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

    if (!budget) {
      return res.status(404).json({
        success: false,
        error: { message: 'Orçamento não encontrado' }
      });
    }

    // Calcular estatísticas
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        categoryId: budget.categoryId,
        transactionDate: {
          gte: budget.startDate,
          lte: budget.endDate
        },
        type: 'expense',
        status: 'completed'
      }
    });

    const spent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const percentage = (spent / Number(budget.amount)) * 100;
    const remaining = Number(budget.amount) - spent;

    res.json({
      success: true,
      data: {
        ...budget,
        amount: Number(budget.amount),
        spent,
        percentage: Math.round(percentage * 100) / 100,
        remaining,
        status: percentage >= 100 ? 'exceeded' : percentage >= 90 ? 'warning' : 'normal'
      }
    });
  } catch (error: any) {
    log.error('Erro ao buscar orçamento:', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Erro ao buscar orçamento' }
    });
  }
});

// ==================== CRIAR ORÇAMENTO ====================
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { categoryId, name, amount, period, alertAt80, alertAt90, alertAt100 } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    // Validações
    if (!categoryId || !name || !amount || !period) {
      return res.status(400).json({
        success: false,
        error: { message: 'Campos obrigatórios: categoryId, name, amount, period' }
      });
    }

    if (!['monthly', 'quarterly', 'semester', 'annual'].includes(period)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Período inválido. Use: monthly, quarterly, semester, annual' }
      });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Valor do orçamento deve ser maior que zero' }
      });
    }

    // Verificar se categoria existe
    const category = await prisma.category.findFirst({
      where: { id: categoryId, tenantId }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: { message: 'Categoria não encontrada' }
      });
    }

    // Calcular datas de início e fim baseadas no período atual
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'quarterly':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
        endDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0, 23, 59, 59);
        break;
      case 'semester':
        const currentSemester = now.getMonth() < 6 ? 0 : 1;
        startDate = new Date(now.getFullYear(), currentSemester * 6, 1);
        endDate = new Date(now.getFullYear(), (currentSemester + 1) * 6, 0, 23, 59, 59);
        break;
      case 'annual':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    // Verificar se já existe orçamento ativo para essa categoria (não por período específico)
    const existingBudget = await prisma.budget.findFirst({
      where: {
        tenantId,
        categoryId,
        period,
        isActive: true
      }
    });

    if (existingBudget) {
      return res.status(400).json({
        success: false,
        error: { message: 'Já existe um orçamento ativo para esta categoria com esse período' }
      });
    }

    const budget = await prisma.budget.create({
      data: {
        tenantId,
        categoryId,
        name,
        amount,
        period,
        startDate,
        endDate,
        alertAt80: alertAt80 !== undefined ? alertAt80 : true,
        alertAt90: alertAt90 !== undefined ? alertAt90 : true,
        alertAt100: alertAt100 !== undefined ? alertAt100 : true,
        isActive: true
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

    res.status(201).json({
      success: true,
      data: {
        ...budget,
        amount: Number(budget.amount)
      }
    });
  } catch (error: any) {
    log.error('Erro ao criar orçamento:', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Erro ao criar orçamento' }
    });
  }
});

// ==================== ATUALIZAR ORÇAMENTO ====================
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { name, amount, period, startDate, endDate, alertAt80, alertAt90, alertAt100, isActive } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    // Verificar se orçamento existe
    const existingBudget = await prisma.budget.findFirst({
      where: { id, tenantId }
    });

    if (!existingBudget) {
      return res.status(404).json({
        success: false,
        error: { message: 'Orçamento não encontrado' }
      });
    }

    // Validações
    if (period && !['monthly', 'quarterly', 'semester', 'annual'].includes(period)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Período inválido. Use: monthly, quarterly, semester, annual' }
      });
    }

    if (amount !== undefined && Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Valor do orçamento deve ser maior que zero' }
      });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (amount !== undefined) updateData.amount = amount;
    if (period !== undefined) updateData.period = period;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    if (alertAt80 !== undefined) updateData.alertAt80 = alertAt80;
    if (alertAt90 !== undefined) updateData.alertAt90 = alertAt90;
    if (alertAt100 !== undefined) updateData.alertAt100 = alertAt100;
    if (isActive !== undefined) updateData.isActive = isActive;
    updateData.updatedAt = new Date();

    const budget = await prisma.budget.update({
      where: { id },
      data: updateData,
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

    res.json({
      success: true,
      data: {
        ...budget,
        amount: Number(budget.amount)
      }
    });
  } catch (error: any) {
    log.error('Erro ao atualizar orçamento:', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Erro ao atualizar orçamento' }
    });
  }
});

// ==================== DELETAR ORÇAMENTO ====================
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const budget = await prisma.budget.findFirst({
      where: { id, tenantId }
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        error: { message: 'Orçamento não encontrado' }
      });
    }

    await prisma.budget.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Orçamento deletado com sucesso'
    });
  } catch (error: any) {
    log.error('Erro ao deletar orçamento:', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Erro ao deletar orçamento' }
    });
  }
});

// ==================== RESUMO DE ORÇAMENTOS ====================
router.get('/summary/overview', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const now = new Date();

    // Buscar todos os orçamentos ativos do período atual
    const budgets = await prisma.budget.findMany({
      where: {
        tenantId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now }
      },
      include: {
        category: true
      }
    });

    let totalBudgeted = 0;
    let totalSpent = 0;
    let budgetsInWarning = 0;
    let budgetsExceeded = 0;

    const detailedBudgets = await Promise.all(
      budgets.map(async (budget) => {
        const transactions = await prisma.transaction.findMany({
          where: {
            tenantId,
            categoryId: budget.categoryId,
            transactionDate: {
              gte: budget.startDate,
              lte: budget.endDate
            },
            type: 'expense',
            status: 'completed',
            deletedAt: null
          }
        });

        const spent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const percentage = (spent / Number(budget.amount)) * 100;

        totalBudgeted += Number(budget.amount);
        totalSpent += spent;

        if (percentage >= 100) budgetsExceeded++;
        else if (percentage >= 80) budgetsInWarning++;

        return {
          id: budget.id,
          name: budget.name,
          category: budget.category.name,
          amount: Number(budget.amount),
          spent,
          percentage: Math.round(percentage * 100) / 100,
          status: percentage >= 100 ? 'exceeded' : percentage >= 90 ? 'warning' : 'normal'
        };
      })
    );

    res.json({
      success: true,
      data: {
        totalBudgeted,
        totalSpent,
        totalRemaining: totalBudgeted - totalSpent,
        overallPercentage: totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 10000) / 100 : 0,
        budgetsInWarning,
        budgetsExceeded,
        budgets: detailedBudgets.sort((a, b) => b.percentage - a.percentage)
      }
    });
  } catch (error: any) {
    log.error('Erro ao buscar resumo:', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Erro ao buscar resumo' }
    });
  }
});

// ==================== ALERTAS DE ORÇAMENTOS ====================
router.get('/alerts/active', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'TenantId não encontrado' }
      });
    }

    const now = new Date();

    const budgets = await prisma.budget.findMany({
      where: {
        tenantId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now }
      },
      include: {
        category: true
      }
    });

    const alerts = [];

    for (const budget of budgets) {
      const transactions = await prisma.transaction.findMany({
        where: {
          tenantId,
          categoryId: budget.categoryId,
          transactionDate: {
            gte: budget.startDate,
            lte: budget.endDate
          },
          type: 'expense',
          status: 'completed'
        }
      });

      const spent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const percentage = (spent / Number(budget.amount)) * 100;

      if ((percentage >= 80 && budget.alertAt80) || 
          (percentage >= 90 && budget.alertAt90) || 
          (percentage >= 100 && budget.alertAt100)) {
        alerts.push({
          budgetId: budget.id,
          budgetName: budget.name,
          category: budget.category.name,
          amount: Number(budget.amount),
          spent,
          percentage: Math.round(percentage * 100) / 100,
          remaining: Number(budget.amount) - spent,
          level: percentage >= 100 ? 'critical' : percentage >= 90 ? 'high' : 'medium'
        });
      }
    }

    res.json({
      success: true,
      data: alerts.sort((a, b) => b.percentage - a.percentage)
    });
  } catch (error: any) {
    log.error('Erro ao buscar alertas:', { error, tenantId: req.tenantId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Erro ao buscar alertas' }
    });
  }
});

export default router;
