/**
 * Partners domain — public types + tipos de erro
 *
 * Fase 0.2 — KYC + ReferralLink (dormente, sem rotas, gated por FF_PARTNERS_*).
 *
 * Convenções:
 *   - Toda interação com DB é feita via DI explícita (db: PartnersDb), nunca
 *     importando prisma global. Mantém os services 100% testáveis sem DB real.
 *   - Erros são tipados (subclasses de PartnersError) com `code` estável para
 *     mapeamento futuro a HTTP / i18n na Fase 0.3+.
 *   - Auditoria segue Opção C decidida no plano:
 *       - kyc_approved, kyc_rejected, referral_link_regenerated → registrados.
 *       - kyc_submitted e referral_link_created → NÃO registrados (enum
 *         PartnerAuditAction não tem esses valores; sem migration nesta fase).
 */

import type { PrismaClient } from '@prisma/client';

/** Subset de delegates que os services Partners 0.2 consomem. */
export type PartnersDb = Pick<
  PrismaClient,
  | 'partnerKyc'
  | 'partnerKycDocument'
  | 'partnerAuditLog'
  | 'referralLink'
  | 'consultantProfile'
  | 'consultantBan'
  | '$transaction'
>;

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

export class PartnersError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PartnersError';
  }
}

export class PartnersFeatureDisabledError extends PartnersError {
  constructor(flag: string) {
    super(`Feature flag '${flag}' is OFF`, 'PARTNERS_FEATURE_DISABLED');
    this.name = 'PartnersFeatureDisabledError';
  }
}

export class KycValidationError extends PartnersError {
  constructor(message: string) {
    super(message, 'KYC_VALIDATION_ERROR');
    this.name = 'KycValidationError';
  }
}

export class KycInvalidTransitionError extends PartnersError {
  constructor(from: string, action: string) {
    super(
      `Transição inválida em PartnerKyc: '${action}' não é permitida a partir do status '${from}'`,
      'KYC_INVALID_TRANSITION',
    );
    this.name = 'KycInvalidTransitionError';
  }
}

export class KycAlreadyApprovedError extends PartnersError {
  constructor(consultantId: string) {
    super(
      `KYC do consultor ${consultantId} já está aprovado; re-submissão não permitida nesta fase`,
      'KYC_ALREADY_APPROVED',
    );
    this.name = 'KycAlreadyApprovedError';
  }
}

export class ConsultantBannedError extends PartnersError {
  constructor(consultantId: string) {
    super(
      `Consultor ${consultantId} está banido; operação Partners bloqueada`,
      'CONSULTANT_BANNED',
    );
    this.name = 'ConsultantBannedError';
  }
}

export class ConsultantNotEligibleError extends PartnersError {
  constructor(consultantId: string, reason: string) {
    super(
      `Consultor ${consultantId} não está elegível: ${reason}`,
      'CONSULTANT_NOT_ELIGIBLE',
    );
    this.name = 'ConsultantNotEligibleError';
  }
}

export class ReferralSlugCollisionError extends PartnersError {
  constructor(attempts: number) {
    super(
      `Não foi possível gerar slug único após ${attempts} tentativas`,
      'REFERRAL_SLUG_COLLISION',
    );
    this.name = 'ReferralSlugCollisionError';
  }
}

// ---------------------------------------------------------------------------
// KYC
// ---------------------------------------------------------------------------

export type KycDocumentTypeInput = 'rg' | 'cpf' | 'comprovante_endereco' | 'selfie';

export interface KycDocumentInput {
  type: KycDocumentTypeInput;
  storageKey: string;
  originalFileName?: string | null;
  mimeType: string;
  sizeBytes: number;
  /** SHA-256 hex (64 chars). Quando presente, ativa dedup idempotente. */
  checksumSha256?: string | null;
}

export interface KycSubmissionInput {
  consultantId: string;
  documents: KycDocumentInput[];
}

export interface KycReviewApproveInput {
  consultantId: string;
  adminUserId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface KycReviewRejectInput {
  consultantId: string;
  adminUserId: string;
  reason: string;
  ip?: string | null;
  userAgent?: string | null;
}

// ---------------------------------------------------------------------------
// Referral Link
// ---------------------------------------------------------------------------

export interface ReferralLinkEnsureInput {
  consultantId: string;
}

export interface ReferralLinkRegenerateInput {
  consultantId: string;
  actorUserId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface ReferralLinkEnsureResult<TLink = unknown> {
  link: TLink;
  /** true quando uma row nova foi criada; false quando reutilizou link já ativo. */
  created: boolean;
}
