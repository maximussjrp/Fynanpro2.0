/**
 * ReferralLinkService — Fase 0.2 (Partners, dormente)
 *
 * Responsabilidades:
 *   - ensure(consultantId) → garante 1 link ativo (idempotente).
 *   - regenerate(input)    → cria slug novo, desativa antigo, audita.
 *   - findActiveBySlug(slug)
 *   - findByConsultant(consultantId)
 *
 * NÃO faz:
 *   - registrar atribuição (ReferralAttribution) — Fase 1+.
 *   - resolver redirecionamento de landing — Fase 0.3.
 *
 * Auditoria (Opção C):
 *   - referral_link_regenerated → registrado em PartnerAuditLog.
 *   - ensure (criação inicial) → NÃO auditado nesta fase
 *     (enum não tem 'referral_link_created'; sem migration).
 *
 * Invariantes:
 *   - ≤ 1 ReferralLink.active=true por consultantId (forçado em $transaction).
 *   - slug @unique global (alfabeto seguro, length 8).
 *
 * DI explícita via deps.db + deps.isEnabled.
 */

import {
  ConsultantBannedError,
  ConsultantNotEligibleError,
  PartnersDb,
  PartnersFeatureDisabledError,
  ReferralLinkEnsureInput,
  ReferralLinkEnsureResult,
  ReferralLinkRegenerateInput,
} from './types';
import { generateUniqueSlug } from './slug-generator';
import { logPartnerAudit } from './partner-audit.logger';

export interface ReferralLinkRow {
  id: string;
  consultantId: string;
  slug: string;
  active: boolean;
  regeneratedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralLinkServiceDeps {
  db: PartnersDb;
  /**
   * Callback que devolve true quando o módulo está habilitado.
   * () => featureFlags['partners.enabled'] && featureFlags['partners.referral.enabled'].
   */
  isEnabled: () => boolean;
}

export interface ReferralLinkService {
  ensure(input: ReferralLinkEnsureInput): Promise<ReferralLinkEnsureResult<ReferralLinkRow>>;
  regenerate(input: ReferralLinkRegenerateInput): Promise<ReferralLinkRow>;
  findActiveBySlug(slug: string): Promise<ReferralLinkRow | null>;
  findByConsultant(consultantId: string): Promise<ReferralLinkRow[]>;
}

export function buildReferralLinkService(
  deps: ReferralLinkServiceDeps,
): ReferralLinkService {
  if (!deps.db) throw new Error('ReferralLinkService: db is required');
  if (typeof deps.isEnabled !== 'function') {
    throw new Error('ReferralLinkService: isEnabled callback is required');
  }

  function assertEnabled(): void {
    if (!deps.isEnabled()) {
      throw new PartnersFeatureDisabledError('partners.referral.enabled');
    }
  }

  async function assertConsultantEligible(consultantId: string): Promise<void> {
    if (!consultantId || consultantId.trim() === '') {
      throw new ConsultantNotEligibleError(consultantId, 'consultantId vazio');
    }
    const consultant = await deps.db.consultantProfile.findUnique({
      where: { id: consultantId },
      select: { id: true, deletedAt: true },
    });
    if (!consultant) {
      throw new ConsultantNotEligibleError(
        consultantId,
        'consultor não encontrado',
      );
    }
    if (consultant.deletedAt) {
      throw new ConsultantNotEligibleError(
        consultantId,
        'consultor soft-deleted',
      );
    }
    const ban = await deps.db.consultantBan.findUnique({
      where: { consultantId },
      select: { id: true },
    });
    if (ban) {
      throw new ConsultantBannedError(consultantId);
    }
  }

  async function isSlugTaken(slug: string): Promise<boolean> {
    const found = await deps.db.referralLink.findUnique({
      where: { slug },
      select: { id: true },
    });
    return !!found;
  }

  return {
    async ensure(input) {
      assertEnabled();
      await assertConsultantEligible(input.consultantId);

      const existingActive = await deps.db.referralLink.findFirst({
        where: { consultantId: input.consultantId, active: true },
      });
      if (existingActive) {
        return { link: existingActive as ReferralLinkRow, created: false };
      }

      const slug = await generateUniqueSlug(isSlugTaken);

      const created = await deps.db.referralLink.create({
        data: {
          consultantId: input.consultantId,
          slug,
          active: true,
        },
      });

      // Sem audit nesta fase (Opção C): enum não tem 'referral_link_created'.
      return { link: created as ReferralLinkRow, created: true };
    },

    async regenerate(input) {
      assertEnabled();
      if (!input.actorUserId || input.actorUserId.trim() === '') {
        throw new ConsultantNotEligibleError(
          input.consultantId,
          'actorUserId é obrigatório',
        );
      }
      await assertConsultantEligible(input.consultantId);

      const slug = await generateUniqueSlug(isSlugTaken);

      const result = await deps.db.$transaction(async (tx: any) => {
        // Marca todos os ativos como inativos (defensivo: em condições normais é 0 ou 1).
        await tx.referralLink.updateMany({
          where: { consultantId: input.consultantId, active: true },
          data: { active: false, regeneratedAt: new Date() },
        });

        const created = await tx.referralLink.create({
          data: {
            consultantId: input.consultantId,
            slug,
            active: true,
          },
        });

        await logPartnerAudit(tx, {
          action: 'referral_link_regenerated',
          actorUserId: input.actorUserId,
          subjectType: 'ReferralLink',
          subjectId: created.id,
          payload: {
            consultantId: input.consultantId,
            newSlug: slug,
          },
          ip: input.ip,
          userAgent: input.userAgent,
        });

        return created;
      });

      return result as ReferralLinkRow;
    },

    async findActiveBySlug(slug) {
      assertEnabled();
      if (!slug || slug.trim() === '') return null;
      const row = await deps.db.referralLink.findUnique({ where: { slug } });
      if (!row || !row.active) return null;
      return row as ReferralLinkRow;
    },

    async findByConsultant(consultantId) {
      assertEnabled();
      const rows = await deps.db.referralLink.findMany({
        where: { consultantId },
        orderBy: { createdAt: 'desc' },
      });
      return rows as ReferralLinkRow[];
    },
  };
}
