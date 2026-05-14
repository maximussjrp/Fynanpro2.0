import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { transactionService } from '../services/transaction.service';
import { aiCategorizationService } from '../services/ai-categorization.service';
import { CreateTransactionSchema, UpdateTransactionSchema, TransactionFiltersSchema } from '../dtos/transaction.dto';
import { log } from '../utils/logger';
import { prisma } from '../utils/prisma-client';
import { z } from 'zod';

// Schema de validação para deleteMode
const DeleteModeSchema = z.enum(['all', 'pending']).catch('pending');

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

// ==================== ROTAS ESPECÍFICAS (ANTES DE /:id) ====================

/**
 * @swagger
 * /transactions/pending-alerts:
 *   get:
 *     summary: Listar alertas de transações pendentes
 *     description: Retorna transações pendentes ou vencidas para alertas
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 */
// GET /api/v1/transactions/pending-alerts
router.get('/pending-alerts', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const daysAhead = parseInt(req.query.daysAhead as string) || 7;

    const transactions = await transactionService.getPendingAlerts(tenantId, userId, daysAhead);

    return successResponse(res, {
      alerts: transactions,
      count: transactions.length,
    });
  } catch (error: any) {
    log.error('Get pending alerts error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar alertas', 500);
  }
});

// GET /api/v1/transactions/ai-status
router.get('/ai-status', async (req: AuthRequest, res: Response) => {
  try {
    const isAvailable = aiCategorizationService.isAvailable();

    return successResponse(res, {
      available: isAvailable,
      model: isAvailable ? 'gemini-2.5-flash-lite' : null,
      message: isAvailable
        ? 'Serviço de categorização com IA disponível'
        : 'GEMINI_API_KEY não configurada',
    });
  } catch (error) {
    log.error('AI status check error', { error });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao verificar status', 500);
  }
});

// PUT /api/v1/transactions/update-status
router.put('/update-status', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { prisma } = await import('../utils/prisma-client');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

// ==================== CHECK PAID CHILDREN ====================
// GET /api/v1/transactions/:id/check-paid
// IMPORTANTE: Esta rota DEVE vir ANTES de GET /:id para não ser capturada pelo parâmetro genérico
router.get('/:id/check-paid', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    // Verificar se a transação existe
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
    });

    if (!transaction) {
      return errorResponse(res, 'NOT_FOUND', 'Transação não encontrada', 404);
    }

    // Contar transações filhas pagas e pendentes
    const [paidCount, pendingCount] = await Promise.all([
      prisma.transaction.count({
        where: {
          parentId: id,
          tenantId,
          deletedAt: null,
          status: 'completed',
        },
      }),
      prisma.transaction.count({
        where: {
          parentId: id,
          tenantId,
          deletedAt: null,
          status: { not: 'completed' },
        },
      }),
    ]);

    return successResponse(res, {
      hasPaidTransactions: paidCount > 0,
      paidCount,
      pendingCount,
      totalCount: paidCount + pendingCount,
    });
  } catch (error: any) {
    log.error('Check paid children error', { 
      error: error.message || error, 
      stack: error.stack,
      id: req.params.id, 
      tenantId: req.tenantId 
    });
    return errorResponse(res, 'INTERNAL_ERROR', error.message || 'Erro ao verificar transações pagas', 500);
  }
});

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

// ==================== UPDATE BATCH (PARCELAS) ====================
// PUT /api/v1/transactions/:id/batch
// Atualiza múltiplas parcelas de um parcelamento com base no escopo
router.put('/:id/batch', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const { scope, ...updateData } = req.body;

    // Validar scope
    if (!scope || !['this', 'thisAndFuture', 'all'].includes(scope)) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Escopo inválido. Use: this, thisAndFuture ou all', 400);
    }

    // Validação dos dados com Zod
    const validatedData = UpdateTransactionSchema.parse(updateData);

    // Chama service
    const result = await transactionService.updateBatch(id, validatedData, tenantId, scope);

    return successResponse(res, {
      message: `${result.updatedCount} parcela(s) atualizada(s) com sucesso`,
      updatedCount: result.updatedCount,
      transactions: result.transactions,
    });
  } catch (error: any) {
    log.error('Update batch transaction error', { error, id: req.params.id, body: req.body, tenantId: req.tenantId });

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

    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao atualizar parcelas', 500);
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
// Query params: 
//   ?cascade=true para deletar também transações filhas (para contas recorrentes)
//   ?deleteMode=all|pending (all = deleta todas incluindo pagas, pending = só pendentes)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!; // Para auditoria
    const cascade = req.query.cascade === 'true';
    
    // Validação com Zod
    const deleteMode = DeleteModeSchema.parse(req.query.deleteMode);

    log.info('TransactionService.delete request', { 
      id, 
      tenantId, 
      userId, 
      cascade, 
      deleteMode,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Chama service com opção de cascade e deleteMode
    const result = await transactionService.delete(id, tenantId, cascade, deleteMode);

    log.info('TransactionService.delete success', { 
      id, 
      tenantId, 
      userId, 
      deletedCount: result.deletedCount,
    });

    return successResponse(res, { 
      message: result.deletedCount > 1 
        ? `${result.deletedCount} transações excluídas com sucesso` 
        : 'Transação excluída com sucesso',
      deletedCount: result.deletedCount,
      hasPaidTransactions: result.hasPaidTransactions,
    });
  } catch (error: any) {
    log.error('Delete transaction error', { 
      error: error.message, 
      stack: error.stack,
      id: req.params.id, 
      tenantId: req.tenantId,
      userId: req.userId,
    });

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

// ==================== PAY TRANSACTION ====================
// POST /api/v1/transactions/:id/pay
router.post('/:id/pay', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const transactionId = req.params.id;
    const { paidDate, bankAccountId, paidAmount } = req.body;

    // Buscar transação
    const transaction = await transactionService.getById(transactionId, tenantId);

    if (!transaction) {
      return errorResponse(res, 'TRANSACTION_NOT_FOUND', 'Transação não encontrada', 404);
    }

    if (transaction.status === 'paid' || transaction.status === 'completed') {
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

    // Atualizar transação e saldo de forma atômica pelo service central
    const updatedTransaction = await transactionService.updateStatus(
      transactionId,
      'completed',
      tenantId,
      paymentDate,
      paidAmount
    );

    const bankAccount = await transactionService.getBankAccount(tenantId, targetBankAccountId);

    if (!bankAccount) {
      return errorResponse(res, 'BANK_ACCOUNT_NOT_FOUND', 'Conta bancária não encontrada', 404);
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

// ==================== ROTAS UNIFICADAS ====================

/**
 * @swagger
 * /transactions/recurring:
 *   post:
 *     summary: Criar transação recorrente
 *     description: Cria uma nova transação recorrente com sua primeira ocorrência
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 */
// POST /api/v1/transactions/recurring
router.post('/recurring', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    // Validação com Zod
    const validatedData = CreateTransactionSchema.parse(req.body);

    if (!validatedData.frequency) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Frequência é obrigatória para transações recorrentes', 400);
    }

    // Chama service
    const result = await transactionService.createRecurring(validatedData, userId, tenantId);

    return successResponse(res, {
      parent: result.parent,
      firstOccurrence: result.firstOccurrence,
      message: 'Transação recorrente criada com sucesso',
    }, 201);
  } catch (error: any) {
    log.error('Create recurring transaction error', { 
      error: error.message || error, 
      errorName: error.name,
      zodErrors: error.errors || null,
      body: req.body, 
      tenantId: req.tenantId 
    });

    if (error.name === 'ZodError') {
      const firstError = error.errors?.[0];
      const errorMessage = firstError 
        ? `${firstError.path?.join('.')}: ${firstError.message}` 
        : 'Dados inválidos';
      return errorResponse(res, 'VALIDATION_ERROR', errorMessage, 400, error.errors);
    }

    if (error.message.includes('obrigatória') || error.message.includes('não encontrada')) {
      return errorResponse(res, 'VALIDATION_ERROR', error.message, 400);
    }

    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao criar transação recorrente', 500);
  }
});

/**
 * @swagger
 * /transactions/installment:
 *   post:
 *     summary: Criar transação parcelada
 *     description: Cria uma nova transação parcelada com todas as parcelas
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 */
// POST /api/v1/transactions/installment
router.post('/installment', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    // Validação com Zod
    const validatedData = CreateTransactionSchema.parse(req.body);

    if (!validatedData.totalInstallments || validatedData.totalInstallments < 2) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Número de parcelas deve ser maior que 1', 400);
    }

    // Chama service
    const result = await transactionService.createInstallment(validatedData, userId, tenantId);

    return successResponse(res, {
      parent: result.parent,
      installments: result.installments,
      message: `Transação parcelada em ${result.installments.length}x criada com sucesso`,
    }, 201);
  } catch (error: any) {
    log.error('Create installment transaction error', { error, body: req.body, tenantId: req.tenantId });

    if (error.name === 'ZodError') {
      return errorResponse(res, 'VALIDATION_ERROR', 'Dados inválidos', 400, error.errors);
    }

    if (error.message.includes('parcelas') || error.message.includes('não encontrada')) {
      return errorResponse(res, 'VALIDATION_ERROR', error.message, 400);
    }

    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao criar transação parcelada', 500);
  }
});

/**
 * @swagger
 * /transactions/{id}/children:
 *   get:
 *     summary: Listar ocorrências/parcelas de uma transação
 *     description: Retorna todas as transações filhas (ocorrências ou parcelas)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 */
// GET /api/v1/transactions/:id/children
router.get('/:id/children', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const children = await transactionService.getChildren(id, tenantId);

    return successResponse(res, {
      parentId: id,
      children,
      count: children.length,
    });
  } catch (error: any) {
    log.error('Get transaction children error', { error, id: req.params.id, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar ocorrências', 500);
  }
});

/**
 * @swagger
 * /transactions/{id}/status:
 *   patch:
 *     summary: Atualizar status de uma transação
 *     description: Atualiza o status de uma transação (pendente -> pago, etc)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 */
// PATCH /api/v1/transactions/:id/status
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const { status, paidDate, paidAmount } = req.body;

    if (!status) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Status é obrigatório', 400);
    }

    const validStatuses = ['scheduled', 'pending', 'overdue', 'completed', 'cancelled', 'skipped'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, 'VALIDATION_ERROR', `Status inválido. Use: ${validStatuses.join(', ')}`, 400);
    }

    const transaction = await transactionService.updateStatus(
      id, 
      status, 
      tenantId,
      paidDate ? new Date(paidDate) : undefined,
      paidAmount
    );

    return successResponse(res, transaction);
  } catch (error: any) {
    log.error('Update transaction status error', { error, id: req.params.id, tenantId: req.tenantId });

    if (error.message === 'Transação não encontrada') {
      return errorResponse(res, 'NOT_FOUND', error.message, 404);
    }

    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao atualizar status', 500);
  }
});

/**
 * @swagger
 * /transactions/{id}/skip:
 *   post:
 *     summary: Pular ocorrência de transação recorrente
 *     description: Marca uma ocorrência como pulada e gera a próxima
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 */
// POST /api/v1/transactions/:id/skip
router.post('/:id/skip', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const transaction = await transactionService.skipOccurrence(id, tenantId);

    return successResponse(res, {
      skippedTransaction: transaction,
      message: 'Ocorrência pulada com sucesso',
    });
  } catch (error: any) {
    log.error('Skip transaction error', { error, id: req.params.id, tenantId: req.tenantId });

    if (error.message.includes('não encontrada') || error.message.includes('não pode ser pulada')) {
      return errorResponse(res, 'VALIDATION_ERROR', error.message, 400);
    }

    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao pular ocorrência', 500);
  }
});

/**
 * @swagger
 * /transactions/{id}/generate-next:
 *   post:
 *     summary: Gerar próxima ocorrência
 *     description: Gera manualmente a próxima ocorrência de uma transação recorrente
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 */
// POST /api/v1/transactions/:id/generate-next
router.post('/:id/generate-next', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    const nextOccurrence = await transactionService.generateNextOccurrence(id, tenantId);

    return successResponse(res, {
      newOccurrence: nextOccurrence,
      message: 'Próxima ocorrência gerada com sucesso',
    }, 201);
  } catch (error: any) {
    log.error('Generate next occurrence error', { error, id: req.params.id, tenantId: req.tenantId });

    if (error.message.includes('não encontrada') || error.message.includes('atingid')) {
      return errorResponse(res, 'VALIDATION_ERROR', error.message, 400);
    }

    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao gerar próxima ocorrência', 500);
  }
});

// ==================== AI CATEGORY SUGGESTION ====================
/**
 * @swagger
 * /transactions/suggest-category:
 *   post:
 *     summary: Sugerir categoria com IA
 *     description: Usa IA (Google Gemini) para sugerir a categoria mais apropriada para uma transação
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
 *               - type
 *             properties:
 *               description:
 *                 type: string
 *                 description: Descrição da transação
 *               amount:
 *                 type: number
 *                 description: Valor da transação
 *               type:
 *                 type: string
 *                 enum: [income, expense]
 *     responses:
 *       200:
 *         description: Sugestão de categoria retornada
 *       400:
 *         description: Dados inválidos
 *       503:
 *         description: Serviço de IA não disponível
 */
router.post('/suggest-category', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { description, amount, type } = req.body;

    // Validação básica
    if (!description || typeof description !== 'string') {
      return errorResponse(res, 'VALIDATION_ERROR', 'Descrição é obrigatória', 400);
    }

    if (!type || !['income', 'expense'].includes(type)) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Tipo deve ser income ou expense', 400);
    }

    // Verificar se serviço está disponível
    if (!aiCategorizationService.isAvailable()) {
      return errorResponse(
        res, 
        'SERVICE_UNAVAILABLE', 
        'Serviço de categorização automática não configurado', 
        503
      );
    }

    // Chamar serviço de IA
    const suggestion = await aiCategorizationService.suggestCategory({
      description,
      amount: amount || 0,
      type,
      tenantId,
    });

    if (!suggestion) {
      return errorResponse(
        res, 
        'AI_ERROR', 
        'Não foi possível sugerir uma categoria', 
        500
      );
    }

    return successResponse(res, {
      suggestion,
      message: 'Categoria sugerida com sucesso',
    });
  } catch (error: any) {
    log.error('Suggest category error', { error, body: req.body, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao sugerir categoria', 500);
  }
});

export default router;
