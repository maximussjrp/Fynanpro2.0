import { Router } from 'express';
import { prisma } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { log } from '../utils/logger';

const router = Router();

// Aplicar autenticação em todas as rotas
router.use(authMiddleware);

// ══════════════════════════════════════════════════════════════════
// LISTAR PERFIS DO TENANT
// ══════════════════════════════════════════════════════════════════
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;

    const profiles = await prisma.userProfile.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
      },
      include: {
        bankAccountOwners: {
          include: {
            bankAccount: {
              select: {
                id: true,
                name: true,
                institution: true,
                type: true,
              },
            },
          },
        },
        _count: {
          select: {
            transactions: true,
          },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    });

    // Calcular movimentação fiscal do mês atual para cada perfil
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const profilesWithFiscal = await Promise.all(profiles.map(async (profile) => {
      // Buscar receitas do mês vinculadas a este perfil
      const incomeResult = await prisma.transaction.aggregate({
        where: {
          tenantId,
          userProfileId: profile.id,
          type: 'income',
          status: 'completed',
          transactionDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          deletedAt: null,
        },
        _sum: {
          amount: true,
        },
        _count: true,
      });

      const monthlyLimit = profile.documentType === 'PJ' ? 15000 : 5000;
      const totalIncome = Number(incomeResult._sum.amount || 0);
      const percentOfLimit = Math.min((totalIncome / monthlyLimit) * 100, 100);

      return {
        id: profile.id,
        name: profile.name,
        document: profile.document,
        documentType: profile.documentType,
        isDefault: profile.isDefault,
        avatar: profile.avatar,
        color: profile.color,
        bankAccounts: profile.bankAccountOwners.map(bao => ({
          id: bao.bankAccount.id,
          name: bao.bankAccount.name,
          institution: bao.bankAccount.institution,
          type: bao.bankAccount.type,
          ownershipPercent: Number(bao.ownershipPercent),
          isPrimaryOwner: bao.isPrimaryOwner,
        })),
        transactionCount: profile._count.transactions,
        fiscal: {
          monthlyLimit,
          totalIncome,
          percentOfLimit: Math.round(percentOfLimit * 10) / 10,
          alertLevel: percentOfLimit >= 100 ? 'exceeded' :
                      percentOfLimit >= 80 ? 'danger' :
                      percentOfLimit >= 50 ? 'warning' : 'safe',
        },
      };
    }));

    return successResponse(res, {
      profiles: profilesWithFiscal,
      count: profilesWithFiscal.length,
    });
  } catch (error: any) {
    log.error('List profiles error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao listar perfis', 500);
  }
});

// ══════════════════════════════════════════════════════════════════
// CRIAR PERFIL
// ══════════════════════════════════════════════════════════════════
router.post('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const { name, document, documentType, avatar, color, isDefault } = req.body;

    if (!name) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Nome é obrigatório', 400);
    }

    // Se este for o primeiro perfil, torna-o padrão
    const existingProfiles = await prisma.userProfile.count({
      where: { tenantId, deletedAt: null },
    });

    const shouldBeDefault = isDefault || existingProfiles === 0;

    // Se este perfil vai ser padrão, remover padrão dos outros
    if (shouldBeDefault) {
      await prisma.userProfile.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Formatar documento (remover caracteres especiais)
    const cleanDocument = document?.replace(/[^\d]/g, '') || null;

    const profile = await prisma.userProfile.create({
      data: {
        tenantId,
        name,
        document: cleanDocument,
        documentType: documentType || 'PF',
        avatar,
        color,
        isDefault: shouldBeDefault,
      },
    });

    log.info('Profile created', { tenantId, profileId: profile.id, name });

    return successResponse(res, { profile }, 201);
  } catch (error: any) {
    log.error('Create profile error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao criar perfil', 500);
  }
});

// ══════════════════════════════════════════════════════════════════
// OBTER PERFIL POR ID
// ══════════════════════════════════════════════════════════════════
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    const profile = await prisma.userProfile.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        bankAccountOwners: {
          include: {
            bankAccount: {
              select: {
                id: true,
                name: true,
                institution: true,
                type: true,
                currentBalance: true,
              },
            },
          },
        },
      },
    });

    if (!profile) {
      return errorResponse(res, 'NOT_FOUND', 'Perfil não encontrado', 404);
    }

    return successResponse(res, { profile });
  } catch (error: any) {
    log.error('Get profile error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar perfil', 500);
  }
});

// ══════════════════════════════════════════════════════════════════
// ATUALIZAR PERFIL
// ══════════════════════════════════════════════════════════════════
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const { name, document, documentType, avatar, color, isDefault } = req.body;

    // Verificar se o perfil existe
    const existing = await prisma.userProfile.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      return errorResponse(res, 'NOT_FOUND', 'Perfil não encontrado', 404);
    }

    // Se este perfil vai ser padrão, remover padrão dos outros
    if (isDefault && !existing.isDefault) {
      await prisma.userProfile.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Formatar documento
    const cleanDocument = document?.replace(/[^\d]/g, '') || existing.document;

    const profile = await prisma.userProfile.update({
      where: { id },
      data: {
        name: name || existing.name,
        document: cleanDocument,
        documentType: documentType || existing.documentType,
        avatar: avatar !== undefined ? avatar : existing.avatar,
        color: color !== undefined ? color : existing.color,
        isDefault: isDefault !== undefined ? isDefault : existing.isDefault,
      },
    });

    log.info('Profile updated', { tenantId, profileId: id });

    return successResponse(res, { profile });
  } catch (error: any) {
    log.error('Update profile error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao atualizar perfil', 500);
  }
});

// ══════════════════════════════════════════════════════════════════
// DELETAR PERFIL (Soft delete)
// ══════════════════════════════════════════════════════════════════
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    // Verificar se o perfil existe
    const existing = await prisma.userProfile.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      return errorResponse(res, 'NOT_FOUND', 'Perfil não encontrado', 404);
    }

    // Não permitir deletar se for o único perfil
    const profileCount = await prisma.userProfile.count({
      where: { tenantId, deletedAt: null },
    });

    if (profileCount <= 1) {
      return errorResponse(res, 'VALIDATION_ERROR', 'Não é possível deletar o único perfil', 400);
    }

    // Soft delete
    await prisma.userProfile.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    // Se era o perfil padrão, definir outro como padrão
    if (existing.isDefault) {
      const nextDefault = await prisma.userProfile.findFirst({
        where: { tenantId, deletedAt: null, id: { not: id } },
        orderBy: { createdAt: 'asc' },
      });

      if (nextDefault) {
        await prisma.userProfile.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
      }
    }

    log.info('Profile deleted', { tenantId, profileId: id });

    return successResponse(res, { message: 'Perfil deletado com sucesso' });
  } catch (error: any) {
    log.error('Delete profile error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao deletar perfil', 500);
  }
});

// ══════════════════════════════════════════════════════════════════
// DEFINIR PERFIL PADRÃO
// ══════════════════════════════════════════════════════════════════
router.post('/:id/set-default', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    // Verificar se o perfil existe
    const existing = await prisma.userProfile.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      return errorResponse(res, 'NOT_FOUND', 'Perfil não encontrado', 404);
    }

    // Remover padrão de todos
    await prisma.userProfile.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });

    // Definir este como padrão
    const profile = await prisma.userProfile.update({
      where: { id },
      data: { isDefault: true },
    });

    log.info('Profile set as default', { tenantId, profileId: id });

    return successResponse(res, { profile });
  } catch (error: any) {
    log.error('Set default profile error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao definir perfil padrão', 500);
  }
});

// ══════════════════════════════════════════════════════════════════
// VINCULAR CONTA BANCÁRIA A PERFIL
// ══════════════════════════════════════════════════════════════════
router.post('/:id/bank-accounts', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id: profileId } = req.params;
    const { bankAccountId, ownershipPercent, isPrimaryOwner } = req.body;

    // Verificar se o perfil existe
    const profile = await prisma.userProfile.findFirst({
      where: { id: profileId, tenantId, deletedAt: null },
    });

    if (!profile) {
      return errorResponse(res, 'NOT_FOUND', 'Perfil não encontrado', 404);
    }

    // Verificar se a conta bancária existe
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, tenantId, deletedAt: null },
    });

    if (!bankAccount) {
      return errorResponse(res, 'NOT_FOUND', 'Conta bancária não encontrada', 404);
    }

    // Verificar se já existe vínculo
    const existingOwner = await prisma.bankAccountOwner.findFirst({
      where: { bankAccountId, userProfileId: profileId },
    });

    if (existingOwner) {
      // Atualizar vínculo existente
      const updated = await prisma.bankAccountOwner.update({
        where: { id: existingOwner.id },
        data: {
          ownershipPercent: ownershipPercent ?? existingOwner.ownershipPercent,
          isPrimaryOwner: isPrimaryOwner ?? existingOwner.isPrimaryOwner,
        },
      });
      return successResponse(res, { owner: updated });
    }

    // Criar novo vínculo
    const owner = await prisma.bankAccountOwner.create({
      data: {
        bankAccountId,
        userProfileId: profileId,
        ownershipPercent: ownershipPercent ?? 100,
        isPrimaryOwner: isPrimaryOwner ?? true,
      },
    });

    log.info('Bank account linked to profile', { tenantId, profileId, bankAccountId });

    return successResponse(res, { owner }, 201);
  } catch (error: any) {
    log.error('Link bank account error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao vincular conta bancária', 500);
  }
});

// ══════════════════════════════════════════════════════════════════
// DESVINCULAR CONTA BANCÁRIA DE PERFIL
// ══════════════════════════════════════════════════════════════════
router.delete('/:id/bank-accounts/:bankAccountId', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const { id: profileId, bankAccountId } = req.params;

    // Verificar se o vínculo existe
    const owner = await prisma.bankAccountOwner.findFirst({
      where: {
        userProfileId: profileId,
        bankAccountId,
        userProfile: { tenantId },
      },
    });

    if (!owner) {
      return errorResponse(res, 'NOT_FOUND', 'Vínculo não encontrado', 404);
    }

    await prisma.bankAccountOwner.delete({
      where: { id: owner.id },
    });

    log.info('Bank account unlinked from profile', { tenantId, profileId, bankAccountId });

    return successResponse(res, { message: 'Conta desvinculada com sucesso' });
  } catch (error: any) {
    log.error('Unlink bank account error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao desvincular conta bancária', 500);
  }
});

// ══════════════════════════════════════════════════════════════════
// OBTER PERFIL ATIVO (para seleção no login)
// ══════════════════════════════════════════════════════════════════
router.get('/session/active', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.tenantId!;

    // Buscar perfis ativos
    const profiles = await prisma.userProfile.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        color: true,
        isDefault: true,
        documentType: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    });

    // Se só tem um perfil, retorna ele como ativo
    // Se tem mais de um, o frontend deve perguntar qual usar
    const needsSelection = profiles.length > 1;
    const defaultProfile = profiles.find(p => p.isDefault) || profiles[0] || null;

    return successResponse(res, {
      profiles,
      needsSelection,
      defaultProfile,
    });
  } catch (error: any) {
    log.error('Get active profile error', { error, tenantId: req.tenantId });
    return errorResponse(res, 'INTERNAL_ERROR', 'Erro ao buscar perfil ativo', 500);
  }
});

export default router;
