import { Router, Response } from 'express';
import { prisma } from '../main';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { log } from '../utils/logger';
import { cacheService, CacheNamespace } from '../services/cache.service';
import { createDefaultCategories } from '../utils/default-categories';

const router = Router();

router.use(authenticateToken);

/**
 * POST /api/v1/data-management/factory-reset
 *
 * "Restaurar configurações de fábrica" — apaga TODOS os dados financeiros
 * do tenant atual e recria as categorias padrão. Mantém apenas: User, Tenant,
 * TenantUser e configurações da conta. Apenas o owner pode executar.
 *
 * Body: { confirm: 'RESETAR' }
 */
router.post('/factory-reset', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { confirm } = req.body || {};

    if (confirm !== 'RESETAR') {
      return errorResponse(
        res,
        'INVALID_CONFIRMATION',
        'Confirmação inválida. Digite RESETAR para confirmar.',
        400
      );
    }

    // Garantir que o usuário é owner deste tenant
    const membership = await prisma.tenantUser.findFirst({
      where: { tenantId, userId },
      select: { role: true },
    });

    if (!membership || membership.role !== 'owner') {
      return errorResponse(
        res,
        'FORBIDDEN',
        'Apenas o proprietário do workspace pode resetar o sistema.',
        403
      );
    }

    log.warn('FactoryReset.start', { tenantId, userId });

    const counts: Record<string, number> = {};

    await prisma.$transaction(async (tx) => {
      // 1) Quebrar auto-relacionamentos (parentId) antes do delete
      await tx.$executeRawUnsafe(
        `UPDATE "Category" SET "parentId" = NULL WHERE "tenantId" = $1`,
        tenantId
      );
      await tx.$executeRawUnsafe(
        `UPDATE "Transaction" SET "parentId" = NULL WHERE "tenantId" = $1`,
        tenantId
      );

      // 2) Deletar dados financeiros / operacionais (ordem: filhos -> pais)
      counts.notifications = (await tx.notification.deleteMany({ where: { tenantId } })).count;
      counts.installments = (await tx.installment.deleteMany({ where: { tenantId } })).count;
      counts.installmentPurchases = (await tx.installmentPurchase.deleteMany({ where: { tenantId } })).count;
      counts.recurringBillOccurrences = (await tx.recurringBillOccurrence.deleteMany({ where: { tenantId } })).count;
      counts.recurringBills = (await tx.recurringBill.deleteMany({ where: { tenantId } })).count;
      counts.transactions = (await tx.transaction.deleteMany({ where: { tenantId } })).count;
      counts.budgets = (await tx.budget.deleteMany({ where: { tenantId } })).count;
      counts.triggerCategories = (await tx.triggerCategory.deleteMany({ where: { tenantId } })).count;
      counts.imports = (await tx.import.deleteMany({ where: { tenantId } })).count;
      counts.savedFilters = (await tx.savedFilter.deleteMany({ where: { tenantId } })).count;
      counts.auditLogs = (await tx.auditLog.deleteMany({ where: { tenantId } })).count;
      counts.categorySemantics = (await tx.categorySemantics.deleteMany({ where: { tenantId } })).count;
      counts.categories = (await tx.category.deleteMany({ where: { tenantId } })).count;
      counts.paymentMethods = (await tx.paymentMethod.deleteMany({ where: { tenantId } })).count;

      // BankAccountOwner não tem tenantId direto — apaga via raw join
      await tx.$executeRawUnsafe(
        `DELETE FROM "BankAccountOwner" WHERE "bankAccountId" IN (SELECT id FROM "BankAccount" WHERE "tenantId" = $1)`,
        tenantId
      );
      counts.bankAccounts = (await tx.bankAccount.deleteMany({ where: { tenantId } })).count;
      counts.userProfiles = (await tx.userProfile.deleteMany({ where: { tenantId } })).count;

      // Sessões de chat (mensagens via cascade pela FK sessionId)
      await tx.$executeRawUnsafe(
        `DELETE FROM "ChatMessage" WHERE "sessionId" IN (SELECT id FROM "ChatSession" WHERE "tenantId" = $1)`,
        tenantId
      );
      counts.chatSessions = (await tx.chatSession.deleteMany({ where: { tenantId } })).count;

      // 3) Recriar categorias padrão (mesma função usada no register)
      await createDefaultCategories(tenantId, tx as any);
    }, { timeout: 60_000 });

    // 4) Invalidar caches do tenant
    await cacheService.invalidateMultiple([
      CacheNamespace.DASHBOARD,
      CacheNamespace.CATEGORIES,
      CacheNamespace.BUDGETS,
      CacheNamespace.REPORTS,
      CacheNamespace.TRANSACTIONS,
      CacheNamespace.ACCOUNTS,
    ]);

    log.warn('FactoryReset.success', { tenantId, userId, counts });

    return successResponse(res, {
      message: 'Sistema resetado com sucesso. Todos os dados financeiros foram apagados e as categorias padrão restauradas.',
      deleted: counts,
    });
  } catch (error: any) {
    log.error('FactoryReset.error', { error: error?.message, stack: error?.stack, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao resetar o sistema. Tente novamente.', 500);
  }
});

export default router;
