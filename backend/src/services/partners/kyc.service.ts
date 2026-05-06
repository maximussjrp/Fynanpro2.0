/**
 * KycService — Fase 0.2 (Partners, dormente)
 *
 * Responsabilidades:
 *   - Submeter KYC com 1+ documentos.
 *   - Aprovar / rejeitar (admin).
 *   - Consultar status / documentos.
 *
 * NÃO faz:
 *   - upload físico (recebe storageKey já existente).
 *   - validação de MIME real além do que veio do caller.
 *   - bloqueio de comissão (Fase 1+).
 *
 * Auditoria (Opção C):
 *   - kyc_approved e kyc_rejected → registrados em PartnerAuditLog.
 *   - submit (criação ou re-submissão) → NÃO auditado nesta fase
 *     (enum PartnerAuditAction não tem 'kyc_submitted'; sem migration).
 *
 * Idempotência:
 *   - submit dedupa documentos por (type, checksumSha256) quando checksum
 *     está presente. Sem checksum → sempre insere.
 *
 * Re-submissão (decisão da Fase 0.2):
 *   - status `pendente`     → submit move para `em_analise` + adiciona docs.
 *   - status `em_analise`   → submit ADICIONA docs (deduped). Status estável.
 *   - status `rejeitado`    → submit REABRE: volta para `em_analise`,
 *                             limpa rejectReason / reviewedAt / reviewedByAdminUserId.
 *   - status `aprovado`     → submit BLOQUEADO (KycAlreadyApprovedError).
 *
 * DI explícita:
 *   - Recebe `db` (PartnersDb) e `isEnabled` (callback de feature flag).
 *   - Sem fallback implícito para prisma global.
 */

import {
  ConsultantBannedError,
  ConsultantNotEligibleError,
  KycAlreadyApprovedError,
  KycDocumentInput,
  KycInvalidTransitionError,
  KycReviewApproveInput,
  KycReviewRejectInput,
  KycSubmissionInput,
  KycValidationError,
  PartnersDb,
  PartnersFeatureDisabledError,
} from './types';
import { logPartnerAudit } from './partner-audit.logger';

const REJECT_REASON_MAX_LEN = 500;
const ALLOWED_DOC_TYPES = ['rg', 'cpf', 'comprovante_endereco', 'selfie'] as const;

export interface KycServiceDeps {
  db: PartnersDb;
  /**
   * Callback que devolve true quando o módulo está habilitado.
   * Espera-se: () => featureFlags['partners.enabled'] && featureFlags['partners.kyc.enabled'].
   * Em testes, basta passar `() => true`.
   */
  isEnabled: () => boolean;
}

export interface KycService {
  submit(input: KycSubmissionInput): Promise<{ id: string; status: string; consultantId: string }>;
  approve(input: KycReviewApproveInput): Promise<{ id: string; status: string }>;
  reject(input: KycReviewRejectInput): Promise<{ id: string; status: string }>;
  getStatus(consultantId: string): Promise<{ id: string; status: string; consultantId: string } | null>;
  listDocuments(consultantId: string): Promise<Array<{ id: string; type: string; storageKey: string }>>;
}

export function buildKycService(deps: KycServiceDeps): KycService {
  if (!deps.db) throw new Error('KycService: db is required');
  if (typeof deps.isEnabled !== 'function') {
    throw new Error('KycService: isEnabled callback is required');
  }

  function assertEnabled(): void {
    if (!deps.isEnabled()) {
      throw new PartnersFeatureDisabledError('partners.kyc.enabled');
    }
  }

  async function assertConsultantEligible(consultantId: string): Promise<void> {
    if (!consultantId || consultantId.trim() === '') {
      throw new KycValidationError('consultantId é obrigatório');
    }
    const consultant = await deps.db.consultantProfile.findUnique({
      where: { id: consultantId },
      select: { id: true, deletedAt: true },
    });
    if (!consultant) {
      throw new ConsultantNotEligibleError(consultantId, 'consultor não encontrado');
    }
    if (consultant.deletedAt) {
      throw new ConsultantNotEligibleError(consultantId, 'consultor soft-deleted');
    }
    const ban = await deps.db.consultantBan.findUnique({
      where: { consultantId },
      select: { id: true },
    });
    if (ban) {
      throw new ConsultantBannedError(consultantId);
    }
  }

  function validateDocuments(documents: KycDocumentInput[]): void {
    if (!Array.isArray(documents) || documents.length === 0) {
      throw new KycValidationError('documents deve conter ao menos 1 documento');
    }
    for (const doc of documents) {
      if (!ALLOWED_DOC_TYPES.includes(doc.type)) {
        throw new KycValidationError(
          `documento de tipo inválido: '${doc.type}'`,
        );
      }
      if (!doc.storageKey || doc.storageKey.trim() === '') {
        throw new KycValidationError('documento sem storageKey');
      }
      if (!doc.mimeType || doc.mimeType.trim() === '') {
        throw new KycValidationError('documento sem mimeType');
      }
      if (typeof doc.sizeBytes !== 'number' || doc.sizeBytes <= 0) {
        throw new KycValidationError('documento com sizeBytes inválido');
      }
      if (doc.checksumSha256 != null && doc.checksumSha256.length !== 64) {
        throw new KycValidationError(
          'checksumSha256 inválido (esperado 64 chars hex)',
        );
      }
    }
  }

  return {
    async submit(input) {
      assertEnabled();
      await assertConsultantEligible(input.consultantId);
      validateDocuments(input.documents);

      const existing = await deps.db.partnerKyc.findUnique({
        where: { consultantId: input.consultantId },
        select: { id: true, status: true },
      });

      if (existing && existing.status === 'aprovado') {
        throw new KycAlreadyApprovedError(input.consultantId);
      }

      const result = await deps.db.$transaction(async (tx: any) => {
        let kycRow: { id: string; status: string };

        if (!existing) {
          kycRow = await tx.partnerKyc.create({
            data: {
              consultantId: input.consultantId,
              status: 'em_analise',
            },
            select: { id: true, status: true },
          });
        } else {
          // re-submissão: pendente|em_analise|rejeitado → em_analise
          kycRow = await tx.partnerKyc.update({
            where: { id: existing.id },
            data: {
              status: 'em_analise',
              rejectReason: null,
              reviewedAt: null,
              reviewedByAdminUserId: null,
            },
            select: { id: true, status: true },
          });
        }

        // Dedup por (kycId, type, checksumSha256). Sem checksum → sempre insere.
        const existingDocs = existing
          ? await tx.partnerKycDocument.findMany({
              where: { kycId: existing.id },
              select: { type: true, checksumSha256: true },
            })
          : [];
        const existingPairs = new Set(
          existingDocs
            .filter((d: any) => d.checksumSha256)
            .map((d: any) => `${d.type}::${d.checksumSha256}`),
        );

        const toInsert = input.documents.filter((doc) => {
          if (!doc.checksumSha256) return true;
          return !existingPairs.has(`${doc.type}::${doc.checksumSha256}`);
        });

        if (toInsert.length > 0) {
          await tx.partnerKycDocument.createMany({
            data: toInsert.map((d) => ({
              kycId: kycRow.id,
              type: d.type as any,
              storageKey: d.storageKey,
              originalFileName: d.originalFileName ?? null,
              mimeType: d.mimeType,
              sizeBytes: d.sizeBytes,
              checksumSha256: d.checksumSha256 ?? null,
            })),
          });
        }

        return kycRow;
      });

      return {
        id: result.id,
        status: result.status,
        consultantId: input.consultantId,
      };
    },

    async approve(input) {
      assertEnabled();
      if (!input.adminUserId || input.adminUserId.trim() === '') {
        throw new KycValidationError('adminUserId é obrigatório');
      }
      await assertConsultantEligible(input.consultantId);

      const existing = await deps.db.partnerKyc.findUnique({
        where: { consultantId: input.consultantId },
        select: { id: true, status: true },
      });
      if (!existing) {
        throw new KycInvalidTransitionError('inexistente', 'approve');
      }
      if (existing.status !== 'em_analise') {
        throw new KycInvalidTransitionError(existing.status, 'approve');
      }

      const result = await deps.db.$transaction(async (tx: any) => {
        const updated = await tx.partnerKyc.update({
          where: { id: existing.id },
          data: {
            status: 'aprovado',
            reviewedAt: new Date(),
            reviewedByAdminUserId: input.adminUserId,
            rejectReason: null,
          },
          select: { id: true, status: true },
        });

        await logPartnerAudit(tx, {
          action: 'kyc_approved',
          actorUserId: input.adminUserId,
          subjectType: 'PartnerKyc',
          subjectId: existing.id,
          payload: {
            consultantId: input.consultantId,
            previousStatus: existing.status,
            newStatus: 'aprovado',
          },
          ip: input.ip,
          userAgent: input.userAgent,
        });

        return updated;
      });

      return result;
    },

    async reject(input) {
      assertEnabled();
      if (!input.adminUserId || input.adminUserId.trim() === '') {
        throw new KycValidationError('adminUserId é obrigatório');
      }
      if (!input.reason || input.reason.trim() === '') {
        throw new KycValidationError('reason é obrigatório');
      }
      if (input.reason.length > REJECT_REASON_MAX_LEN) {
        throw new KycValidationError(
          `reason excede ${REJECT_REASON_MAX_LEN} caracteres`,
        );
      }
      await assertConsultantEligible(input.consultantId);

      const existing = await deps.db.partnerKyc.findUnique({
        where: { consultantId: input.consultantId },
        select: { id: true, status: true },
      });
      if (!existing) {
        throw new KycInvalidTransitionError('inexistente', 'reject');
      }
      if (existing.status !== 'em_analise') {
        throw new KycInvalidTransitionError(existing.status, 'reject');
      }

      const result = await deps.db.$transaction(async (tx: any) => {
        const updated = await tx.partnerKyc.update({
          where: { id: existing.id },
          data: {
            status: 'rejeitado',
            reviewedAt: new Date(),
            reviewedByAdminUserId: input.adminUserId,
            rejectReason: input.reason,
          },
          select: { id: true, status: true },
        });

        await logPartnerAudit(tx, {
          action: 'kyc_rejected',
          actorUserId: input.adminUserId,
          subjectType: 'PartnerKyc',
          subjectId: existing.id,
          payload: {
            consultantId: input.consultantId,
            previousStatus: existing.status,
            newStatus: 'rejeitado',
            reasonLength: input.reason.length,
          },
          ip: input.ip,
          userAgent: input.userAgent,
        });

        return updated;
      });

      return result;
    },

    async getStatus(consultantId) {
      assertEnabled();
      if (!consultantId) return null;
      const row = await deps.db.partnerKyc.findUnique({
        where: { consultantId },
        select: { id: true, status: true, consultantId: true },
      });
      return row ?? null;
    },

    async listDocuments(consultantId) {
      assertEnabled();
      const kyc = await deps.db.partnerKyc.findUnique({
        where: { consultantId },
        select: { id: true },
      });
      if (!kyc) return [];
      const docs = await deps.db.partnerKycDocument.findMany({
        where: { kycId: kyc.id },
        select: { id: true, type: true, storageKey: true },
        orderBy: { uploadedAt: 'asc' },
      });
      return docs as Array<{ id: string; type: string; storageKey: string }>;
    },
  };
}
