import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { transactionService } from '../services/transaction.service';
import { CreateTransactionSchema, UpdateTransactionSchema, TransactionFiltersSchema } from '../dtos/transaction.dto';
import { log } from '../utils/logger';

const router = Router();

// Middleware de autenticação em todas as rotas
router.use(authenticateToken);

/**
 * @swagger
 * /transactions:
 *   get:
 *     summary: Listar transações
 *     description: Retorna lista de transações com filtros e paginação
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [INCOME, EXPENSE]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PAID, CANCELLED]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Lista de transações
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Transaction'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         description: Não autenticado
 */
// ==================== GET ALL TRANSACTIONS ====================
// GET /api/v1/transactions
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;

    // Validação com Zod
    const filters = TransactionFiltersSchema.parse(req.query);

    // Chama service
    const result = await transactionService.getAll(tenantId, filters);

    return successResponse(res, {
      transactions: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    log.error('Get transactions error', { error, tenantId: req.tenantId });

    // Zod validation error
    if (error.name === 'ZodError') {
      return errorResponse(res, 'VALIDATION_ERROR', 'Filtros inválidos', 400, error.errors);
    }

    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar transações', 500);
  }
});

/**
 * @swagger
 * /transactions/{id}:
 *   get:
 *     summary: Buscar transação por ID
 *     description: Retorna detalhes completos de uma transação específica do tenant
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da transação
 *     responses:
 *       200:
 *         description: Transação encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Transaction'
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Transação não encontrada ou não pertence ao tenant
 */
// ==================== GET TRANSACTION BY ID ====================
// GET /api/v1/transactions/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    // Chama service
    const transaction = await transactionService.getById(id, tenantId);

    return successResponse(res, transaction);
  } catch (error: any) {
    log.error('Get transaction error', { error, id: req.params.id, tenantId: req.tenantId });

    if (error.message === 'Transação não encontrada') {
      return errorResponse(res, 'NOT_FOUND', error.message, 404);
    }

    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar transação', 500);
  }
});

/**
 * @swagger
 * /transactions:
 *   post:
 *     summary: Criar transação
 *     description: Cria uma nova transação (receita ou despesa)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *               - amount
 *               - type
 *               - categoryId
 *               - bankAccountId
 *               - date
 *             properties:
 *               description:
 *                 type: string
 *                 example: Compra no supermercado
 *               amount:
 *                 type: number
 *                 format: double
 *                 example: 150.50
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *               status:
 *                 type: string
 *                 enum: [PENDING, PAID, CANCELLED]
 *                 default: PAID
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               bankAccountId:
 *                 type: string
 *                 format: uuid
 *               paymentMethodId:
 *                 type: string
 *                 format: uuid
 *               date:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Transação criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autenticado
 */
// ==================== CREATE TRANSACTION ====================
// POST /api/v1/transactions
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    // Validação com Zod
    const validatedData = CreateTransactionSchema.parse(req.body);

    // Chama service
    const transaction = await transactionService.create(validatedData, userId, tenantId);

    return successResponse(res, transaction, 201);
  } catch (error: any) {
    log.error('Create transaction error', { error, body: req.body, tenantId: req.tenantId });

    // Zod validation error
    if (error.name === 'ZodError') {
      return errorResponse(res, 'VALIDATION_ERROR', 'Dados inválidos', 400, error.errors);
    }

    // Business logic errors
    if (
      error.message === 'Categoria não encontrada' ||
      error.message === 'Categoria não é de receita' ||
      error.message === 'Categoria não é de despesa' ||
      error.message === 'Conta bancária não encontrada' ||
      error.message === 'Meio de pagamento não encontrado'
    ) {
      return errorResponse(res, 'VALIDATION_ERROR', error.message, 400);
    }

    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao criar transação', 500);
  }
});

/**
 * @swagger
 * /transactions/{id}:
 *   put:
 *     summary: Atualizar transação
 *     description: Atualiza dados de uma transação existente. Recalcula saldos das contas automaticamente.
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da transação a ser atualizada
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 example: Supermercado Dia
 *               amount:
 *                 type: number
 *                 format: double
 *                 example: 250.75
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *               status:
 *                 type: string
 *                 enum: [PENDING, PAID, CANCELLED]
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               bankAccountId:
 *                 type: string
 *                 format: uuid
 *               paymentMethodId:
 *                 type: string
 *                 format: uuid
 *               date:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Transação atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Transação não encontrada
 */
// ==================== UPDATE TRANSACTION ====================
// PUT /api/v1/transactions/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    // Validação com Zod
    const validatedData = UpdateTransactionSchema.parse(req.body);

    // Chama service
    const transaction = await transactionService.update(id, validatedData, tenantId);

    return successResponse(res, transaction);
  } catch (error: any) {
    log.error('Update transaction error', { error, id: req.params.id, body: req.body, tenantId: req.tenantId });

    // Zod validation error
    if (error.name === 'ZodError') {
      return errorResponse(res, 'VALIDATION_ERROR', 'Dados inválidos', 400, error.errors);
    }

    // Business logic errors
    if (error.message === 'Transação não encontrada') {
      return errorResponse(res, 'NOT_FOUND', error.message, 404);
    }

    if (
      error.message === 'Categoria não encontrada' ||
      error.message === 'Categoria não é de receita' ||
      error.message === 'Categoria não é de despesa' ||
      error.message === 'Conta bancária não encontrada' ||
      error.message === 'Meio de pagamento não encontrado'
    ) {
      return errorResponse(res, 'VALIDATION_ERROR', error.message, 400);
    }

    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao atualizar transação', 500);
  }
});

/**
 * @swagger
 * /transactions/{id}:
 *   delete:
 *     summary: Excluir transação
 *     description: Realiza soft delete da transação e reverte o saldo da conta bancária
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da transação a ser excluída
 *     responses:
 *       200:
 *         description: Transação excluída com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Transação excluída com sucesso
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Transação não encontrada ou não pertence ao tenant
 */
// ==================== DELETE TRANSACTION ====================
// DELETE /api/v1/transactions/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    // Chama service
    await transactionService.delete(id, tenantId);

    return successResponse(res, { message: 'Transação excluída com sucesso' });
  } catch (error: any) {
    log.error('Delete transaction error', { error, id: req.params.id, tenantId: req.tenantId });

    if (error.message === 'Transação não encontrada') {
      return errorResponse(res, 'NOT_FOUND', error.message, 404);
    }

    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao excluir transação', 500);
  }
});

// ==================== GET TRANSACTION SUMMARY ====================
// GET /api/v1/transactions/summary
router.get('/stats/summary', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;

    // Validação com Zod
    const filters = TransactionFiltersSchema.parse(req.query);

    if (!filters.startDate || !filters.endDate) {
      return errorResponse(res, 'VALIDATION_ERROR', 'startDate e endDate são obrigatórios', 400);
    }

    // Chama service
    const summary = await transactionService.getSummary(tenantId, filters);

    return successResponse(res, {
      period: {
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
      income: {
        total: summary.totalIncome,
      },
      expense: {
        total: summary.totalExpense,
      },
      transfers: {
        total: summary.totalTransfers,
      },
      balance: {
        value: summary.balance,
        isPositive: summary.balance >= 0,
      },
      transactionCount: summary.transactionCount,
      avgTransactionValue: summary.avgTransactionValue,
    });
  } catch (error: any) {
    log.error('Get summary error', { error, tenantId: req.tenantId });

    // Zod validation error
    if (error.name === 'ZodError') {
      return errorResponse(res, 'VALIDATION_ERROR', 'Filtros inválidos', 400, error.errors);
    }

    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar resumo', 500);
  }
});

// ==================== UPDATE OVERDUE TRANSACTIONS ====================
// PUT /api/v1/transactions/update-status
router.put('/update-status', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { prisma } = await import('../utils/prisma-client');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Atualizar para overdue
    const updated = await prisma.transaction.updateMany({
      where: {
        tenantId,
        status: 'pending',
        transactionDate: {
          lt: today
        },
        deletedAt: null
      },
      data: {
        status: 'overdue'
      }
    });

    log.info('Updated overdue transactions', { tenantId, count: updated.count });

    return successResponse(res, {
      updated: updated.count,
      message: `${updated.count} transação(ões) atualizada(s) para vencida(s)`
    });
  } catch (error: any) {
    log.error('Update status error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao atualizar status', 500);
  }
});

// ==================== PAY TRANSACTION ====================
// POST /api/v1/transactions/:id/pay
router.post('/:id/pay', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const transactionId = req.params.id;
    const { paidDate, bankAccountId } = req.body;

    // Buscar transação
    const transaction = await transactionService.getById(tenantId, transactionId);

    if (!transaction) {
      return errorResponse(res, 'TRANSACTION_NOT_FOUND', 'Transação não encontrada', 404);
    }

    if (transaction.status === 'paid') {
      return errorResponse(res, 'ALREADY_PAID', 'Transação já foi paga', 400);
    }

    if (transaction.status === 'cancelled') {
      return errorResponse(res, 'TRANSACTION_CANCELLED', 'Transação cancelada', 400);
    }

    // Data do pagamento (default: hoje)
    const paymentDate = paidDate ? new Date(paidDate) : new Date();
    const dueDate = transaction.dueDate || transaction.transactionDate;

    // Calcular se foi pago antecipado/atrasado
    const daysDiff = Math.floor((paymentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const isPaidEarly = daysDiff < 0;
    const isPaidLate = daysDiff > 0;
    const daysEarlyLate = Math.abs(daysDiff);

    // Determinar conta bancária a debitar
    const targetBankAccountId = bankAccountId || transaction.bankAccountId;

    if (!targetBankAccountId) {
      return errorResponse(res, 'BANK_ACCOUNT_REQUIRED', 'Conta bancária não especificada', 400);
    }

    // Verificar saldo (apenas para EXPENSE)
    if (transaction.type === 'EXPENSE') {
      const bankAccount = await transactionService.getBankAccount(tenantId, targetBankAccountId);

      if (!bankAccount) {
        return errorResponse(res, 'BANK_ACCOUNT_NOT_FOUND', 'Conta bancária não encontrada', 404);
      }

      if (bankAccount.currentBalance < transaction.amount) {
        return errorResponse(res, 'INSUFFICIENT_BALANCE', 'Saldo insuficiente', 400);
      }
    }

    // Atualizar transação
    const updatedTransaction = await transactionService.pay(transactionId, {
      status: 'paid',
      paidDate: paymentDate,
      isPaidEarly: isPaidEarly || undefined,
      isPaidLate: isPaidLate || undefined,
      daysEarlyLate: daysEarlyLate > 0 ? daysEarlyLate : undefined,
      bankAccountId: targetBankAccountId,
    });

    // Atualizar saldo da conta bancária
    const bankAccount = await transactionService.updateBankAccountBalance(
      tenantId,
      targetBankAccountId,
      transaction.type === 'INCOME' ? transaction.amount : -transaction.amount
    );

    // Se for recorrente, gerar próximo mês automaticamente
    if (transaction.recurringBillId) {
      const recurringBill = await transactionService.getRecurringBill(tenantId, transaction.recurringBillId);

      if (recurringBill && recurringBill.status === 'active') {
        const monthsAhead = recurringBill.monthsAhead || 1;

        // Calcular próxima data baseado na frequência
        let nextDueDate = new Date(dueDate);
        switch (recurringBill.frequency) {
          case 'monthly':
            nextDueDate.setMonth(nextDueDate.getMonth() + monthsAhead);
            break;
          case 'weekly':
            nextDueDate.setDate(nextDueDate.getDate() + (7 * monthsAhead));
            break;
          case 'biweekly':
            nextDueDate.setDate(nextDueDate.getDate() + (14 * monthsAhead));
            break;
          case 'yearly':
            nextDueDate.setFullYear(nextDueDate.getFullYear() + monthsAhead);
            break;
          default:
            nextDueDate.setMonth(nextDueDate.getMonth() + monthsAhead);
        }

        // Verificar se já existe transação para esta data
        const existingNext = await transactionService.findByDateAndRecurringBill(
          tenantId,
          transaction.recurringBillId,
          nextDueDate
        );

        if (!existingNext) {
          await transactionService.create({
            categoryId: transaction.categoryId,
            bankAccountId: transaction.bankAccountId,
            paymentMethodId: transaction.paymentMethodId,
            recurringBillId: transaction.recurringBillId,
            description: transaction.description,
            amount: Number(transaction.amount),
            type: transaction.type as 'income' | 'expense' | 'transfer',
            status: 'pending',
            transactionDate: nextDueDate,
            dueDate: nextDueDate,
            isFixed: transaction.isFixed,
          }, req.userId!, tenantId);

          log.info('Next occurrence auto-generated', {
            tenantId,
            recurringBillId: transaction.recurringBillId,
            nextDueDate,
          });
        }
      }
    }

    // Criar notificação
    await transactionService.createNotification(tenantId, req.userId!, {
      type: isPaidEarly ? 'payment_due' : (isPaidLate ? 'payment_due' : 'transaction'),
      title: isPaidEarly 
        ? `Pagamento Antecipado - ${transaction.description}` 
        : (isPaidLate 
          ? `Pagamento Atrasado - ${transaction.description}` 
          : `Pagamento Realizado - ${transaction.description}`),
      message: isPaidEarly
        ? `Você pagou ${transaction.description} com ${daysEarlyLate} dia(s) de antecedência. 🎉`
        : (isPaidLate
          ? `Você pagou ${transaction.description} com ${daysEarlyLate} dia(s) de atraso. ⚠️`
          : `Pagamento de ${transaction.description} realizado com sucesso! ✅`),
      priority: isPaidLate ? 'urgent' : 'normal',
      relatedType: 'transaction',
      relatedId: transactionId,
      actionUrl: `/transactions/${transactionId}`,
      transactionId: transactionId,
    });

    log.info('Transaction paid', {
      tenantId,
      transactionId,
      amount: transaction.amount,
      isPaidEarly,
      isPaidLate,
      daysEarlyLate,
    });

    return successResponse(res, {
      transaction: updatedTransaction,
      bankAccount: {
        id: bankAccount.id,
        name: bankAccount.name,
        balance: bankAccount.currentBalance,
      },
      paymentStatus: {
        isPaidEarly,
        isPaidLate,
        daysEarlyLate,
        paidDate: paymentDate,
      },
    });
  } catch (error: any) {
    log.error('Pay transaction error', { error, tenantId: req.tenantId, transactionId: req.params.id });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao processar pagamento', 500);
  }
});

export default router;

