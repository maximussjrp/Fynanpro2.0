import { Router, Request, Response } from 'express';
import { prisma } from '../main';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { log } from '../utils/logger';

const router = Router();

// Middleware de autenticação
router.use(authenticateToken);

// ==================== GET ALL BANK ACCOUNTS ====================
// GET /api/v1/bank-accounts
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

    const accounts = await prisma.bankAccount.findMany({
      where,
      orderBy: [
        { order: 'asc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        type: true,
        institution: true,
        currentBalance: true,
        initialBalance: true,
        isActive: true,
        color: true,
        icon: true,
        order: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            transactions: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    // Calculate totals
    const totals = {
      all: accounts.reduce((sum, acc) => sum + Number(acc.currentBalance), 0),
      bank: accounts.filter(a => a.type === 'bank').reduce((sum, acc) => sum + Number(acc.currentBalance), 0),
      wallet: accounts.filter(a => a.type === 'wallet').reduce((sum, acc) => sum + Number(acc.currentBalance), 0),
      credit_card: accounts.filter(a => a.type === 'credit_card').reduce((sum, acc) => sum + Number(acc.currentBalance), 0),
      investment: accounts.filter(a => a.type === 'investment').reduce((sum, acc) => sum + Number(acc.currentBalance), 0),
    };

    return successResponse(res, {
      accounts,
      totals,
      summary: {
        total: accounts.length,
        active: accounts.filter(a => a.isActive).length,
        inactive: accounts.filter(a => !a.isActive).length,
      },
    });
  } catch (error) {
    log.error('Get bank accounts error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar contas bancárias', 500);
  }
});

// ==================== GET BANK ACCOUNT BY ID ====================
// GET /api/v1/bank-accounts/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const account = await prisma.bankAccount.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        transactions: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            transactionDate: 'desc',
          },
          take: 10,
          include: {
            category: {
              select: {
                id: true,
                name: true,
                icon: true,
                color: true,
              },
            },
          },
        },
        _count: {
          select: {
            transactions: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    if (!account) {
      return errorResponse(res, 'NOT_FOUND', 'Conta bancária não encontrada', 404);
    }

    return successResponse(res, account);
  } catch (error) {
    log.error('Get bank account error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar conta bancária', 500);
  }
});

// ==================== CREATE BANK ACCOUNT ====================
// POST /api/v1/bank-accounts
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    
    // Log detalhado para debug
    log.info('Create bank account request', {
      tenantId,
      body: req.body,
    });
    
    const {
      name,
      type,
      institution,
      initialBalance = 0,
      color,
      icon,
      order = 0,
    } = req.body;

    // Validations
    if (!name || !name.trim()) {
      log.warn('Validation error: name missing', { body: req.body });
      return errorResponse(res, 'VALIDATION_ERROR', 'Nome da conta é obrigatório', 400);
    }

    if (!type || !['bank', 'wallet', 'credit_card', 'investment', 'other'].includes(type)) {
      log.warn('Validation error: invalid type', { type, body: req.body });
      return errorResponse(res, 'VALIDATION_ERROR', 'Tipo de conta inválido', 400);
    }

    // Check if account with same name exists
    const existingAccount = await prisma.bankAccount.findFirst({
      where: {
        tenantId,
        name: name.trim(),
        deletedAt: null,
      },
    });

    if (existingAccount) {
      log.warn('Validation error: duplicate account name', { name: name.trim(), tenantId });
      return errorResponse(res, 'VALIDATION_ERROR', 'Já existe uma conta com este nome', 400);
    }

    // Create account
    const account = await prisma.bankAccount.create({
      data: {
        tenantId,
        name: name.trim(),
        type,
        institution: institution?.trim() || null,
        initialBalance,
        currentBalance: initialBalance,
        color,
        icon,
        order,
      },
    });

    return successResponse(res, account, 201);
  } catch (error) {
    log.error('Create bank account error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao criar conta bancária', 500);
  }
});

// ==================== UPDATE BANK ACCOUNT ====================
// PUT /api/v1/bank-accounts/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const {
      name,
      type,
      institution,
      isActive,
      color,
      icon,
      order,
    } = req.body;

    // Find existing account
    const existingAccount = await prisma.bankAccount.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
    });

    if (!existingAccount) {
      return errorResponse(res, 'NOT_FOUND', 'Conta bancária não encontrada', 404);
    }

    // Validations
    if (name && !name.trim()) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Nome da conta não pode ser vazio', 400);
    }

    if (type && !['bank', 'wallet', 'credit_card', 'investment', 'other'].includes(type)) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Tipo de conta inválido', 400);
    }

    // Check if name is unique
    if (name && name.trim() !== existingAccount.name) {
      const duplicateName = await prisma.bankAccount.findFirst({
        where: {
          tenantId,
          name: name.trim(),
          deletedAt: null,
          NOT: { id },
        },
      });

      if (duplicateName) {
        return errorResponse(res, 'VALIDATION_ERROR', 'Já existe uma conta com este nome', 400);
      }
    }

    // Update account
    const updatedAccount = await prisma.bankAccount.update({
      where: { id },
      data: {
        name: name ? name.trim() : existingAccount.name,
        type: type || existingAccount.type,
        institution: institution !== undefined ? (institution?.trim() || null) : existingAccount.institution,
        isActive: isActive !== undefined ? isActive : existingAccount.isActive,
        color: color !== undefined ? color : existingAccount.color,
        icon: icon !== undefined ? icon : existingAccount.icon,
        order: order !== undefined ? order : existingAccount.order,
      },
    });

    return successResponse(res, updatedAccount);
  } catch (error) {
    log.error('Update bank account error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao atualizar conta bancária', 500);
  }
});

// ==================== DELETE BANK ACCOUNT ====================
// DELETE /api/v1/bank-accounts/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    // Find account
    const account = await prisma.bankAccount.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            transactions: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    if (!account) {
      return errorResponse(res, 'NOT_FOUND', 'Conta bancária não encontrada', 404);
    }

    // Check if has transactions
    if (account._count.transactions > 0) {
      return errorResponse(
        res,
        'VALIDATION_ERROR',
        'Não é possível excluir conta com transações. Inative a conta ou transfira as transações.',
        400
      );
    }

    // Soft delete
    await prisma.bankAccount.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return successResponse(res, { message: 'Conta bancária excluída com sucesso' });
  } catch (error) {
    log.error('Delete bank account error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao excluir conta bancária', 500);
  }
});

// ==================== TRANSFER BETWEEN ACCOUNTS ====================
// POST /api/v1/bank-accounts/transfer
router.post('/transfer/execute', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      fromAccountId,
      toAccountId,
      amount,
      description,
      transactionDate,
    } = req.body;

    // Validations
    if (!fromAccountId || !toAccountId) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Contas de origem e destino são obrigatórias', 400);
    }

    if (fromAccountId === toAccountId) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Contas de origem e destino devem ser diferentes', 400);
    }

    if (!amount || amount <= 0) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Valor deve ser maior que zero', 400);
    }

    if (!transactionDate) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Data da transferência é obrigatória', 400);
    }

    // Validate accounts exist
    const [fromAccount, toAccount] = await Promise.all([
      prisma.bankAccount.findFirst({
        where: { id: fromAccountId, tenantId, deletedAt: null },
      }),
      prisma.bankAccount.findFirst({
        where: { id: toAccountId, tenantId, deletedAt: null },
      }),
    ]);

    if (!fromAccount) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Conta de origem não encontrada', 400);
    }

    if (!toAccount) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Conta de destino não encontrada', 400);
    }

    // Check if has sufficient balance
    if (Number(fromAccount.currentBalance) < amount) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Saldo insuficiente na conta de origem', 400);
    }

    // Create transfer transactions (expense from origin + income to destination)
    const transferDate = new Date(transactionDate);
    const transferDescription = description || `Transferência: ${fromAccount.name} → ${toAccount.name}`;

    const [expenseTransaction, incomeTransaction] = await Promise.all([
      // Expense from origin account
      prisma.transaction.create({
        data: {
          tenantId,
          userId,
          type: 'transfer',
          bankAccountId: fromAccountId,
          destinationAccountId: toAccountId,
          amount,
          description: transferDescription,
          transactionDate: transferDate,
          status: 'completed',
        },
      }),
      // Income to destination account
      prisma.transaction.create({
        data: {
          tenantId,
          userId,
          type: 'transfer',
          bankAccountId: toAccountId,
          destinationAccountId: fromAccountId,
          amount,
          description: transferDescription,
          transactionDate: transferDate,
          status: 'completed',
        },
      }),
    ]);

    // Update balances
    await Promise.all([
      prisma.bankAccount.update({
        where: { id: fromAccountId },
        data: {
          currentBalance: {
            decrement: amount,
          },
        },
      }),
      prisma.bankAccount.update({
        where: { id: toAccountId },
        data: {
          currentBalance: {
            increment: amount,
          },
        },
      }),
    ]);

    // Get updated accounts
    const [updatedFromAccount, updatedToAccount] = await Promise.all([
      prisma.bankAccount.findUnique({ where: { id: fromAccountId } }),
      prisma.bankAccount.findUnique({ where: { id: toAccountId } }),
    ]);

    return successResponse(res, {
      transfer: {
        from: {
          account: updatedFromAccount,
          transaction: expenseTransaction,
        },
        to: {
          account: updatedToAccount,
          transaction: incomeTransaction,
        },
        amount,
        description: transferDescription,
        date: transferDate,
      },
    }, 201);
  } catch (error) {
    log.error('Transfer error:', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao realizar transferência', 500);
  }
});

export default router;
