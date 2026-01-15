import { Router, Response } from 'express';
import { prisma } from '../main';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { log } from '../utils/logger';

const router = Router();

router.use(authenticateToken);

// ==================== GET ALL INSTALLMENT PURCHASES ====================
// GET /api/v1/installments
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { status } = req.query;

    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (status) {
      where.status = status as string;
    }

    const purchases = await prisma.installmentPurchase.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
        installments: {
          orderBy: {
            installmentNumber: 'asc',
          },
          include: {
            bankAccount: {
              select: {
                id: true,
                name: true,
              },
            },
            paymentMethod: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            installments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate progress
    const purchasesWithProgress = purchases.map(purchase => {
      const nextInstallment = purchase.installments.find((inst: any) => inst.status === 'pending');
      return {
        ...purchase,
        progress: purchase.numberOfInstallments > 0
          ? (purchase.paidInstallments / purchase.numberOfInstallments) * 100
          : 0,
        nextInstallment,
      };
    });

    return successResponse(res, {
      purchases: purchasesWithProgress,
      summary: {
        total: purchases.length,
        active: purchases.filter(p => p.status === 'active').length,
        completed: purchases.filter(p => p.status === 'completed').length,
        cancelled: purchases.filter(p => p.status === 'cancelled').length,
        totalOwed: purchases.reduce((sum, p) => sum + Number(p.remainingBalance), 0),
      },
    });
  } catch (error) {
    log.error('Get installment purchases error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar compras parceladas', 500);
  }
});

// ==================== GET INSTALLMENT PURCHASE BY ID ====================
// GET /api/v1/installments/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const purchase = await prisma.installmentPurchase.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        category: true,
        installments: {
          orderBy: {
            installmentNumber: 'asc',
          },
          include: {
            paymentMethod: true,
          },
        },
      },
    });

    if (!purchase) {
      return errorResponse(res, 'NOT_FOUND', 'Compra parcelada não encontrada', 404);
    }

    return successResponse(res, purchase);
  } catch (error) {
    log.error('Get installment purchase error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar compra parcelada', 500);
  }
});

// ==================== CREATE INSTALLMENT PURCHASE ====================
// POST /api/v1/installments
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const {
      name,
      description,
      totalAmount,
      numberOfInstallments,
      categoryId,
      firstDueDate,
      notes,
    } = req.body;

    // Validations
    if (!name || !name.trim()) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Nome é obrigatório', 400);
    }

    if (!totalAmount || totalAmount <= 0) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Valor total deve ser maior que zero', 400);
    }

    if (!numberOfInstallments || numberOfInstallments < 2) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Número de parcelas deve ser no mínimo 2', 400);
    }

    if (!firstDueDate) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Data da primeira parcela é obrigatória', 400);
    }

    // Validate category
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          tenantId,
          type: 'expense',
          deletedAt: null,
        },
      });

      if (!category) {
        return errorResponse(res, 'VALIDATION_ERROR', 'Categoria não encontrada ou não é de despesa', 400);
      }
    }

    // Calculate installment amount
    const installmentAmount = totalAmount / numberOfInstallments;

    // Create purchase
    const purchase = await prisma.installmentPurchase.create({
      data: {
        tenantId,
        name: name.trim(),
        description: description?.trim(),
        totalAmount,
        numberOfInstallments,
        installmentAmount,
        remainingBalance: totalAmount,
        paidInstallments: 0,
        categoryId,
        firstDueDate: new Date(firstDueDate),
        notes,
        status: 'active',
      },
    });

    // Generate installments
    const firstDate = new Date(firstDueDate);
    const installments = [];

    for (let i = 0; i < numberOfInstallments; i++) {
      const dueDate = new Date(firstDate);
      dueDate.setMonth(firstDate.getMonth() + i);

      installments.push({
        tenantId,
        installmentPurchaseId: purchase.id,
        installmentNumber: i + 1,
        amount: installmentAmount,
        dueDate,
        status: 'pending' as const,
      });
    }

    await prisma.installment.createMany({
      data: installments,
    });

    // Return with installments
    const purchaseWithInstallments = await prisma.installmentPurchase.findUnique({
      where: { id: purchase.id },
      include: {
        category: true,
        installments: {
          orderBy: {
            installmentNumber: 'asc',
          },
        },
      },
    });

    return successResponse(res, purchaseWithInstallments, 201);
  } catch (error) {
    log.error('Create installment purchase error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao criar compra parcelada', 500);
  }
});

// ==================== UPDATE INSTALLMENT PURCHASE ====================
// PUT /api/v1/installments/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const {
      description,
      categoryId,
      bankAccountId,
      paymentMethodId,
      status,
      notes,
    } = req.body;

    const existing = await prisma.installmentPurchase.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return errorResponse(res, 'NOT_FOUND', 'Compra parcelada não encontrada', 404);
    }

    const updated = await prisma.installmentPurchase.update({
      where: { id },
      data: {
        description: description ? description.trim() : existing.description,
        categoryId: categoryId !== undefined ? categoryId : existing.categoryId,
        status: status || existing.status,
        notes: notes !== undefined ? notes : existing.notes,
      },
      include: {
        category: true,
        installments: {
          orderBy: {
            installmentNumber: 'asc',
          },
        },
      },
    });

    return successResponse(res, updated);
  } catch (error) {
    log.error('Update installment purchase error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao atualizar compra parcelada', 500);
  }
});

// ==================== DELETE INSTALLMENT PURCHASE ====================
// DELETE /api/v1/installments/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const purchase = await prisma.installmentPurchase.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
    });

    if (!purchase) {
      return errorResponse(res, 'NOT_FOUND', 'Compra parcelada não encontrada', 404);
    }

    await prisma.installmentPurchase.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'cancelled',
      },
    });

    return successResponse(res, { message: 'Compra parcelada excluída com sucesso' });
  } catch (error) {
    log.error('Delete installment purchase error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao excluir compra parcelada', 500);
  }
});

// ==================== PAY INSTALLMENT ====================
// POST /api/v1/installments/:purchaseId/installments/:installmentId/pay
router.post('/:purchaseId/installments/:installmentId/pay', async (req: AuthRequest, res: Response) => {
  try {
    const { purchaseId, installmentId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { paidAmount, paidDate, createTransaction = true } = req.body;

    // Find installment
    const installment = await prisma.installment.findFirst({
      where: {
        id: installmentId,
        installmentPurchaseId: purchaseId,
      },
    });

    if (!installment) {
      return errorResponse(res, 'NOT_FOUND', 'Parcela não encontrada', 404);
    }

    // Get purchase
    const purchase = await prisma.installmentPurchase.findFirst({
      where: {
        id: purchaseId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!purchase) {
      return errorResponse(res, 'NOT_FOUND', 'Compra parcelada não encontrada', 404);
    }
    const paymentAmount = paidAmount || Number(installment.amount);

    // Update installment
    const updated = await prisma.installment.update({
      where: { id: installmentId },
      data: {
        status: 'paid',
        paidDate: paidDate ? new Date(paidDate) : new Date(),
        paidAmount: paymentAmount,
      },
    });

    // Update purchase
    await prisma.installmentPurchase.update({
      where: { id: purchaseId },
      data: {
        paidInstallments: {
          increment: 1,
        },
        remainingBalance: {
          decrement: paymentAmount,
        },
        status: purchase.paidInstallments + 1 >= purchase.numberOfInstallments ? 'completed' : 'active',
      },
    });

    // Create transaction if requested and has required fields
    if (createTransaction && installment.bankAccountId && purchase.categoryId) {
      await prisma.transaction.create({
        data: {
          tenantId,
          userId,
          type: 'expense',
          categoryId: purchase.categoryId,
          bankAccountId: installment.bankAccountId,
          paymentMethodId: installment.paymentMethodId,
          amount: paymentAmount,
          description: `${purchase.description} - Parcela ${installment.installmentNumber}/${purchase.numberOfInstallments}`,
          transactionDate: paidDate ? new Date(paidDate) : new Date(),
          status: 'completed',
          installmentId: installmentId,
        },
      });

      // Update bank account balance
      await prisma.bankAccount.update({
        where: { id: installment.bankAccountId },
        data: {
          currentBalance: {
            decrement: paymentAmount,
          },
        },
      });
    }

    return successResponse(res, updated);
  } catch (error) {
    log.error('Pay installment error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao registrar pagamento da parcela', 500);
  }
});

// ==================== GENERATE TRANSACTIONS FROM INSTALLMENTS ====================
// POST /api/v1/installments/generate-transactions
router.post('/generate-transactions', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Buscar parcelas pendentes que estão vencendo ou vencidas
    const dueInstallments = await prisma.installment.findMany({
      where: {
        tenantId,
        status: 'pending',
        dueDate: {
          lte: today,
        },
      },
      include: {
        installmentPurchase: {
          include: {
            category: true,
          },
        },
      },
    });

    let generated = 0;

    for (const installment of dueInstallments) {
      // Verificar se já existe transação para essa parcela
      const existingTransaction = await prisma.transaction.findFirst({
        where: {
          tenantId,
          installmentId: installment.id,
          deletedAt: null,
        },
      });

      if (!existingTransaction) {
        // Criar transação
        await prisma.transaction.create({
          data: {
            tenantId,
            userId,
            categoryId: installment.installmentPurchase.categoryId,
            bankAccountId: installment.bankAccountId,
            paymentMethodId: installment.paymentMethodId,
            type: 'EXPENSE',
            amount: installment.amount,
            description: `${installment.installmentPurchase.name} - Parcela ${installment.installmentNumber}/${installment.installmentPurchase.numberOfInstallments}`,
            transactionDate: installment.dueDate,
            status: 'pending',
            installmentId: installment.id,
          },
        });
        
        generated++;
      }
    }

    return successResponse(res, {
      generated,
      message: `${generated} transação(ões) gerada(s) a partir de parcelamentos`,
    });
  } catch (error) {
    log.error('Generate installment transactions error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao gerar transações de parcelamentos', 500);
  }
});

export default router;
