/**
 * LGPD Service
 * Serviço para conformidade com a Lei Geral de Proteção de Dados
 * 
 * Funcionalidades:
 * - Exportar todos os dados do usuário (portabilidade)
 * - Anonimizar e excluir conta (direito ao esquecimento)
 * - Gerenciar consentimentos
 * - Registrar auditoria de acesso aos dados
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ExportedData {
  user: {
    id: string;
    fullName: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
  };
  tenants: Array<{
    id: string;
    name: string;
    role: string;
    createdAt: Date;
  }>;
  transactions: Array<{
    id: string;
    description: string | null;
    amount: number;
    type: string;
    transactionDate: Date;
    category: string | null;
    bankAccount: string | null;
    createdAt: Date;
  }>;
  bankAccounts: Array<{
    id: string;
    name: string;
    type: string;
    currentBalance: number;
    createdAt: Date;
  }>;
  categories: Array<{
    id: string;
    name: string;
    type: string;
    createdAt: Date;
  }>;
  consents: Array<{
    id: string;
    type: string;
    version: string;
    accepted: boolean;
    acceptedAt: Date | null;
    revokedAt: Date | null;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    resourceType: string | null;
    createdAt: Date;
  }>;
  exportedAt: Date;
  format: string;
}

interface ConsentInput {
  type: 'terms_of_use' | 'privacy_policy' | 'marketing' | 'data_sharing';
  version: string;
  accepted: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export class LGPDService {
  /**
   * Exportar todos os dados do usuário (LGPD Art. 18, V - Portabilidade)
   */
  async exportUserData(userId: string, requestInfo?: { ipAddress?: string; userAgent?: string }): Promise<ExportedData> {
    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Buscar tenants do usuário
    const tenantUsers = await prisma.tenantUser.findMany({
      where: { userId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
        },
      },
    });

    const tenants = tenantUsers.map((tu) => ({
      id: tu.tenant.id,
      name: tu.tenant.name,
      role: tu.role,
      createdAt: tu.tenant.createdAt,
    }));

    const tenantIds = tenants.map((t) => t.id);

    // Buscar transações
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId: { in: tenantIds },
        deletedAt: null,
      },
      include: {
        category: { select: { name: true } },
        bankAccount: { select: { name: true } },
      },
      orderBy: { transactionDate: 'desc' },
    });

    // Buscar contas bancárias
    const bankAccounts = await prisma.bankAccount.findMany({
      where: {
        tenantId: { in: tenantIds },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        currentBalance: true,
        createdAt: true,
      },
    });

    // Buscar categorias customizadas
    const categories = await prisma.category.findMany({
      where: {
        tenantId: { in: tenantIds },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
      },
    });

    // Buscar consentimentos (se a tabela existir após migração)
    let consents: any[] = [];
    try {
      consents = await (prisma as any).consent?.findMany?.({
        where: { userId },
        select: {
          id: true,
          type: true,
          version: true,
          accepted: true,
          acceptedAt: true,
          revokedAt: true,
        },
      }) || [];
    } catch {
      // Tabela ainda não existe
      consents = [];
    }

    // Buscar logs de auditoria (últimos 90 dias)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        userId,
        createdAt: { gte: ninetyDaysAgo },
      },
      select: {
        id: true,
        action: true,
        resourceType: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    // Registrar exportação no audit log
    await prisma.auditLog.create({
      data: {
        userId,
        tenantId: tenantIds[0] || null,
        action: 'LGPD_DATA_EXPORT',
        resourceType: 'UserData',
        resourceId: userId,
        ipAddress: requestInfo?.ipAddress,
        userAgent: requestInfo?.userAgent,
        changes: JSON.stringify({
          exportedAt: new Date().toISOString(),
        }),
      },
    });

    return {
      user,
      tenants,
      transactions: transactions.map((t) => ({
        id: t.id,
        description: t.description,
        amount: Number(t.amount),
        type: t.type,
        transactionDate: t.transactionDate,
        category: t.category?.name || null,
        bankAccount: t.bankAccount?.name || null,
        createdAt: t.createdAt,
      })),
      bankAccounts: bankAccounts.map((ba) => ({
        ...ba,
        currentBalance: Number(ba.currentBalance),
      })),
      categories,
      consents,
      auditLogs,
      exportedAt: new Date(),
      format: 'JSON',
    };
  }

  /**
   * Anonimizar e excluir conta (LGPD Art. 18, VI - Eliminação)
   * Mantém registros anonimizados para integridade contábil
   */
  async deleteUserAccount(
    userId: string,
    confirmation: string,
    requestInfo?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ success: boolean; message: string; deletedAt: Date }> {
    if (confirmation !== 'EXCLUIR MINHA CONTA') {
      throw new Error('Confirmação inválida. Digite exatamente: EXCLUIR MINHA CONTA');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantUsers: true,
      },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const deletedAt = new Date();
    const anonymizedEmail = `deleted_${userId.substring(0, 8)}@anonimo.local`;
    const anonymizedName = 'Usuário Removido';

    // Usar transação para garantir atomicidade
    await prisma.$transaction(async (tx) => {
      // 1. Registrar log de exclusão ANTES de anonimizar
      const tenantIds = user.tenantUsers.map((tu) => tu.tenantId);
      
      await tx.auditLog.create({
        data: {
          userId,
          tenantId: tenantIds[0] || null,
          action: 'LGPD_ACCOUNT_DELETION',
          resourceType: 'User',
          resourceId: userId,
          ipAddress: requestInfo?.ipAddress,
          userAgent: requestInfo?.userAgent,
          changes: JSON.stringify({
            originalEmail: user.email,
            deletedAt: deletedAt.toISOString(),
          }),
        },
      });

      // 2. Revogar todos os tokens
      await tx.refreshToken.updateMany({
        where: { userId },
        data: { 
          isRevoked: true,
          revokedAt: deletedAt,
          revokedReason: 'LGPD_account_deletion',
        },
      });

      // 3. Revogar consentimentos (se tabela existir)
      try {
        await (tx as any).consent?.updateMany?.({
          where: { userId, revokedAt: null },
          data: { revokedAt: deletedAt },
        });
      } catch {
        // Tabela ainda não existe
      }

      // 4. Soft delete de transações (manter para integridade contábil)
      for (const tu of user.tenantUsers) {
        await tx.transaction.updateMany({
          where: { 
            tenantId: tu.tenantId,
            userId: userId,
            deletedAt: null,
          },
          data: { deletedAt },
        });
      }

      // 5. Remover vínculos com tenants (soft delete)
      // TenantUser não tem deletedAt, então vamos deletar
      await tx.tenantUser.deleteMany({
        where: { userId },
      });

      // 6. Anonimizar e soft delete do usuário
      await tx.user.update({
        where: { id: userId },
        data: {
          fullName: anonymizedName,
          email: anonymizedEmail,
          passwordHash: 'DELETED',
          isActive: false,
          deletedAt,
        },
      });
    });

    return {
      success: true,
      message: 'Conta excluída e dados anonimizados conforme LGPD',
      deletedAt,
    };
  }

  /**
   * Registrar consentimento (LGPD Art. 8)
   * Nota: Requer que a migração com tabela Consent já tenha sido executada
   */
  async registerConsent(
    userId: string,
    consent: ConsentInput
  ): Promise<{ id: string; type: string; accepted: boolean; acceptedAt: Date | null }> {
    // Verificar se a tabela existe
    const consentModel = (prisma as any).consent;
    if (!consentModel) {
      throw new Error('Tabela de consentimentos ainda não foi criada. Execute a migração do Prisma.');
    }

    // Verificar se já existe consentimento para este tipo
    const existing = await consentModel.findFirst({
      where: {
        userId,
        type: consent.type,
        revokedAt: null,
      },
    });

    if (existing) {
      // Revogar anterior se estiver mudando
      await consentModel.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
    }

    const newConsent = await consentModel.create({
      data: {
        userId,
        type: consent.type,
        version: consent.version,
        accepted: consent.accepted,
        acceptedAt: consent.accepted ? new Date() : null,
        ipAddress: consent.ipAddress,
        userAgent: consent.userAgent,
      },
    });

    return {
      id: newConsent.id,
      type: newConsent.type,
      accepted: newConsent.accepted,
      acceptedAt: newConsent.acceptedAt,
    };
  }

  /**
   * Listar consentimentos do usuário
   */
  async getUserConsents(userId: string) {
    const consentModel = (prisma as any).consent;
    if (!consentModel) {
      return { active: [], history: [] };
    }

    const consents = await consentModel.findMany({
      where: { userId },
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    });

    // Agrupar por tipo e pegar o mais recente ativo
    const activeConsents: Record<string, any> = {};
    
    for (const consent of consents) {
      if (!consent.revokedAt) {
        if (!activeConsents[consent.type]) {
          activeConsents[consent.type] = consent;
        }
      }
    }

    return {
      active: Object.values(activeConsents),
      history: consents,
    };
  }

  /**
   * Revogar consentimento específico
   */
  async revokeConsent(userId: string, consentType: string): Promise<{ success: boolean; message: string }> {
    const consentModel = (prisma as any).consent;
    if (!consentModel) {
      throw new Error('Tabela de consentimentos ainda não foi criada. Execute a migração do Prisma.');
    }

    const consent = await consentModel.findFirst({
      where: {
        userId,
        type: consentType,
        revokedAt: null,
      },
    });

    if (!consent) {
      throw new Error('Consentimento não encontrado ou já revogado');
    }

    // Não permitir revogar termos de uso (necessário para usar o sistema)
    if (consentType === 'terms_of_use') {
      throw new Error('Não é possível revogar os Termos de Uso. Para isso, exclua sua conta.');
    }

    await consentModel.update({
      where: { id: consent.id },
      data: { revokedAt: new Date() },
    });

    return {
      success: true,
      message: `Consentimento "${consentType}" revogado com sucesso`,
    };
  }

  /**
   * Verificar se usuário tem consentimento ativo
   */
  async hasActiveConsent(userId: string, consentType: string): Promise<boolean> {
    const consentModel = (prisma as any).consent;
    if (!consentModel) {
      return false;
    }

    const consent = await consentModel.findFirst({
      where: {
        userId,
        type: consentType,
        accepted: true,
        revokedAt: null,
      },
    });

    return !!consent;
  }

  /**
   * Gerar relatório de privacidade (para DPO/encarregado)
   */
  async generatePrivacyReport(tenantId: string): Promise<{
    totalUsers: number;
    activeConsents: Record<string, number>;
    dataExportsLast30Days: number;
    accountDeletionsLast30Days: number;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Total de usuários do tenant
    const totalUsers = await prisma.tenantUser.count({
      where: { tenantId },
    });

    // Buscar IDs dos usuários do tenant
    const tenantUsers = await prisma.tenantUser.findMany({
      where: { tenantId },
      select: { userId: true },
    });
    const userIds = tenantUsers.map((tu) => tu.userId);

    // Consentimentos ativos por tipo
    let activeConsents: Record<string, number> = {};
    try {
      const consentModel = (prisma as any).consent;
      if (consentModel) {
        const consents = await consentModel.groupBy({
          by: ['type'],
          where: {
            userId: { in: userIds },
            accepted: true,
            revokedAt: null,
          },
          _count: { id: true },
        });

        for (const c of consents) {
          activeConsents[c.type] = c._count.id;
        }
      }
    } catch {
      // Tabela ainda não existe
    }

    // Exportações nos últimos 30 dias
    const dataExportsLast30Days = await prisma.auditLog.count({
      where: {
        tenantId,
        createdAt: { gte: thirtyDaysAgo },
        action: 'LGPD_DATA_EXPORT',
      },
    });

    // Exclusões nos últimos 30 dias
    const accountDeletionsLast30Days = await prisma.auditLog.count({
      where: {
        tenantId,
        createdAt: { gte: thirtyDaysAgo },
        action: 'LGPD_ACCOUNT_DELETION',
      },
    });

    return {
      totalUsers,
      activeConsents,
      dataExportsLast30Days,
      accountDeletionsLast30Days,
    };
  }
}

export const lgpdService = new LGPDService();
