/**
 * ConsultantService — Fase 2A (CONSULTANT / CLIENT BASE)
 *
 * Regras arquiteturais:
 *   - Aditivo. Nenhuma rota/lógica legada é alterada.
 *   - `ClientProfile.consultantUserId` é a fonte de verdade da relação
 *     consultor ↔ cliente. `Tenant.managedByConsultantId` (futuro) NÃO é
 *     consultado aqui.
 *   - Fase 2A NÃO concede acesso ao tenant financeiro do cliente — apenas
 *     leitura dos vínculos.
 *   - Todos os métodos respeitam soft-delete (`deletedAt IS NULL`).
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma-client';
import { log } from '../utils/logger';
import type {
  ApplyConsultantDTO,
  UpdateConsultantDTO,
  ListClientsQueryDTO,
  ListConsultantsQueryDTO,
} from '../dtos/consultant.dto';

// --------------------------------------------------------------------------
// Tipos de erro específicos (mantêm consistência com o padrão do projeto).
// --------------------------------------------------------------------------

export class ConsultantNotFoundError extends Error {
  public readonly code = 'CONSULTANT_NOT_FOUND';
  constructor(message = 'Perfil de consultor não encontrado') {
    super(message);
    this.name = 'ConsultantNotFoundError';
  }
}

export class ConsultantAlreadyExistsError extends Error {
  public readonly code = 'CONSULTANT_ALREADY_EXISTS';
  constructor(message = 'Usuário já possui perfil de consultor') {
    super(message);
    this.name = 'ConsultantAlreadyExistsError';
  }
}

export class ConsultantSlugTakenError extends Error {
  public readonly code = 'CONSULTANT_SLUG_TAKEN';
  constructor(message = 'publicSlug já está em uso') {
    super(message);
    this.name = 'ConsultantSlugTakenError';
  }
}

export class ConsultantNotActiveError extends Error {
  public readonly code = 'CONSULTANT_NOT_ACTIVE';
  constructor(
    public readonly status: string,
    message = 'Perfil de consultor não está ativo',
  ) {
    super(message);
    this.name = 'ConsultantNotActiveError';
  }
}

// --------------------------------------------------------------------------
// Serviço
// --------------------------------------------------------------------------

export class ConsultantService {
  /**
   * Retorna o próprio perfil. Lança se não existir.
   */
  async getMyProfile(userId: string) {
    const profile = await prisma.consultantProfile.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!profile) throw new ConsultantNotFoundError();
    return profile;
  }

  /**
   * Credenciamento: cria o perfil do consultor no estado PENDING.
   * Status inicial é sempre PENDING — aprovação é manual (admin).
   */
  async apply(userId: string, data: ApplyConsultantDTO) {
    const existing = await prisma.consultantProfile.findFirst({
      where: { userId, deletedAt: null },
    });
    if (existing) throw new ConsultantAlreadyExistsError();

    try {
      const created = await prisma.consultantProfile.create({
        data: {
          userId,
          // status e tier seguem os defaults do schema (PENDING, BRONZE).
          displayName: data.displayName ?? null,
          bio: data.bio ?? null,
          publicSlug: data.publicSlug ?? null,
        },
      });
      log.info('Consultant apply', { userId, consultantId: created.id });
      return created;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Conflito em `publicSlug` (único) ou `userId` (race com unique).
        const target = (err.meta?.target as string[] | undefined) ?? [];
        if (target.includes('publicSlug')) throw new ConsultantSlugTakenError();
        throw new ConsultantAlreadyExistsError();
      }
      throw err;
    }
  }

  /**
   * Atualiza apenas campos básicos do próprio perfil.
   * Não altera status nem tier (reservado para admin).
   */
  async updateMyProfile(userId: string, data: UpdateConsultantDTO) {
    const profile = await prisma.consultantProfile.findFirst({
      where: { userId, deletedAt: null },
    });
    if (!profile) throw new ConsultantNotFoundError();

    try {
      const updated = await prisma.consultantProfile.update({
        where: { id: profile.id },
        data: {
          ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
          ...(data.bio !== undefined ? { bio: data.bio } : {}),
          ...(data.publicSlug !== undefined ? { publicSlug: data.publicSlug } : {}),
        },
      });
      return updated;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConsultantSlugTakenError();
      }
      throw err;
    }
  }

  /**
   * Lista clientes vinculados ao consultor autenticado.
   * Fonte de verdade: ClientProfile.consultantUserId (NÃO Tenant.managedByConsultantId).
   *
   * Retorna somente metadados do vínculo — sem acesso ao tenant financeiro.
   */
  async listMyClients(consultantUserId: string, query: ListClientsQueryDTO) {
    // Exige consultor ACTIVE para consumir a listagem.
    const profile = await prisma.consultantProfile.findFirst({
      where: { userId: consultantUserId, deletedAt: null },
    });
    if (!profile) throw new ConsultantNotFoundError();
    if (profile.status !== 'ACTIVE') {
      throw new ConsultantNotActiveError(profile.status);
    }

    const where: Prisma.ClientProfileWhereInput = {
      consultantUserId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.clientProfile.findMany({
        where,
        select: {
          id: true,
          clientUserId: true,
          tenantId: true,
          status: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          client: {
            select: { id: true, fullName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.clientProfile.count({ where }),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  // ------------------------------------------------------------------------
  // Admin (super_master) — revisão de credenciamento
  // ------------------------------------------------------------------------

  async adminList(query: ListConsultantsQueryDTO) {
    const where: Prisma.ConsultantProfileWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.consultantProfile.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.consultantProfile.count({ where }),
    ]);
    return { items, total, limit: query.limit, offset: query.offset };
  }

  async adminApprove(consultantProfileId: string) {
    const profile = await prisma.consultantProfile.findFirst({
      where: { id: consultantProfileId, deletedAt: null },
    });
    if (!profile) throw new ConsultantNotFoundError();
    return prisma.consultantProfile.update({
      where: { id: profile.id },
      data: { status: 'ACTIVE', approvedAt: profile.approvedAt ?? new Date() },
    });
  }

  async adminSuspend(consultantProfileId: string) {
    const profile = await prisma.consultantProfile.findFirst({
      where: { id: consultantProfileId, deletedAt: null },
    });
    if (!profile) throw new ConsultantNotFoundError();
    return prisma.consultantProfile.update({
      where: { id: profile.id },
      data: { status: 'SUSPENDED' },
    });
  }

  async adminReject(consultantProfileId: string) {
    const profile = await prisma.consultantProfile.findFirst({
      where: { id: consultantProfileId, deletedAt: null },
    });
    if (!profile) throw new ConsultantNotFoundError();
    return prisma.consultantProfile.update({
      where: { id: profile.id },
      data: { status: 'INACTIVE' },
    });
  }
}

export const consultantService = new ConsultantService();
