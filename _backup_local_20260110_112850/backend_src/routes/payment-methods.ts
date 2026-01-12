import { Router, Response } from 'express';
import { prisma } from '../main';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { log } from '../utils/logger';

const router = Router();

router.use(authenticateToken);

// ==================== GET ALL PAYMENT METHODS ====================
// GET /api/v1/payment-methods
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { isActive } = req.query;

    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const paymentMethods = await prisma.paymentMethod.findMany({
      where,
      orderBy: [
        { order: 'asc' },
        { name: 'asc' },
      ],
      include: {
        bankAccount: {
          select: {
            id: true,
            name: true,
            type: true,
            institution: true,
            currentBalance: true,
          },
        },
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    });

    return successResponse(res, {
      methods: paymentMethods,
      summary: {
        total: paymentMethods.length,
        active: paymentMethods.filter(p => p.isActive).length,
        inactive: paymentMethods.filter(p => !p.isActive).length,
      },
    });
  } catch (error) {
    log.error('Get payment methods error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar meios de pagamento', 500);
  }
});

// ==================== CREATE PAYMENT METHOD ====================
// POST /api/v1/payment-methods
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const {
      name,
      type,
      bankAccountId,
      lastFourDigits,
      cardNetwork,
      expirationDate,
    } = req.body;

    // Validações
    if (!name || !name.trim()) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Nome é obrigatório', 400);
    }

    if (!type || !['pix', 'credit_card', 'debit_card', 'boleto', 'cash', 'bank_transfer', 'automatic_debit'].includes(type)) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Tipo inválido', 400);
    }

    // Validar conta bancária se fornecida
    if (bankAccountId) {
      const account = await prisma.bankAccount.findFirst({
        where: {
          id: bankAccountId,
          tenantId,
          deletedAt: null,
        },
      });

      if (!account) {
        return errorResponse(res, 'VALIDATION_ERROR', 'Conta bancária não encontrada', 400);
      }
    }

    // Criar meio de pagamento
    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        tenantId,
        name: name.trim(),
        type,
        bankAccountId,
        lastFourDigits: lastFourDigits?.trim() || null,
        cardNetwork: cardNetwork?.trim() || null,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
      },
      include: {
        bankAccount: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return successResponse(res, paymentMethod, 201);
  } catch (error) {
    log.error('Create payment method error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao criar meio de pagamento', 500);
  }
});

// ==================== UPDATE PAYMENT METHOD ====================
// PUT /api/v1/payment-methods/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const {
      name,
      isActive,
      bankAccountId,
      lastFourDigits,
      cardNetwork,
      expirationDate,
    } = req.body;

    // Buscar método existente
    const existing = await prisma.paymentMethod.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return errorResponse(res, 'NOT_FOUND', 'Meio de pagamento não encontrado', 404);
    }

    // Atualizar
    const updated = await prisma.paymentMethod.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        bankAccountId: bankAccountId !== undefined ? bankAccountId : existing.bankAccountId,
        lastFourDigits: lastFourDigits !== undefined ? (lastFourDigits?.trim() || null) : existing.lastFourDigits,
        cardNetwork: cardNetwork !== undefined ? (cardNetwork?.trim() || null) : existing.cardNetwork,
        expirationDate: expirationDate !== undefined ? (expirationDate ? new Date(expirationDate) : null) : existing.expirationDate,
      },
      include: {
        bankAccount: true,
      },
    });

    return successResponse(res, updated);
  } catch (error) {
    log.error('Update payment method error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao atualizar meio de pagamento', 500);
  }
});

// ==================== DELETE PAYMENT METHOD ====================
// DELETE /api/v1/payment-methods/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    });

    if (!paymentMethod) {
      return errorResponse(res, 'NOT_FOUND', 'Meio de pagamento não encontrado', 404);
    }

    // Verificar se tem transações
    if (paymentMethod._count.transactions > 0) {
      return errorResponse(
        res,
        'VALIDATION_ERROR',
        'Não é possível excluir meio de pagamento com transações. Inative o método.',
        400
      );
    }

    // Soft delete
    await prisma.paymentMethod.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return successResponse(res, { message: 'Meio de pagamento excluído com sucesso' });
  } catch (error) {
    log.error('Delete payment method error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao excluir meio de pagamento', 500);
  }
});

// ==================== MIGRATE AND DELETE PAYMENT METHOD ====================
// POST /api/v1/payment-methods/:id/migrate
// Migra todas as transações para outro meio de pagamento e exclui o original
router.post('/:id/migrate', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { targetPaymentMethodId } = req.body;
    const tenantId = req.tenantId!;

    if (!targetPaymentMethodId) {
      return errorResponse(res, 'VALIDATION_ERROR', 'ID do meio de pagamento destino é obrigatório', 400);
    }

    if (id === targetPaymentMethodId) {
      return errorResponse(res, 'VALIDATION_ERROR', 'O meio de pagamento destino deve ser diferente do original', 400);
    }

    // Buscar meio de pagamento original
    const sourceMethod = await prisma.paymentMethod.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            transactions: true,
          },
        },
      },
    });

    if (!sourceMethod) {
      return errorResponse(res, 'NOT_FOUND', 'Meio de pagamento de origem não encontrado', 404);
    }

    // Buscar meio de pagamento destino
    const targetMethod = await prisma.paymentMethod.findFirst({
      where: {
        id: targetPaymentMethodId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!targetMethod) {
      return errorResponse(res, 'NOT_FOUND', 'Meio de pagamento destino não encontrado', 404);
    }

    // Migrar transações
    const updateResult = await prisma.transaction.updateMany({
      where: {
        paymentMethodId: id,
        tenantId,
        deletedAt: null,
      },
      data: {
        paymentMethodId: targetPaymentMethodId,
      },
    });

    // Soft delete do meio de pagamento original
    await prisma.paymentMethod.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    log.info('Payment method migrated and deleted', {
      sourceId: id,
      targetId: targetPaymentMethodId,
      migratedTransactions: updateResult.count,
      tenantId,
    });

    return successResponse(res, {
      message: `${updateResult.count} transações migradas com sucesso. Meio de pagamento excluído.`,
      migratedCount: updateResult.count,
    });
  } catch (error) {
    log.error('Migrate payment method error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao migrar meio de pagamento', 500);
  }
});

export default router;
