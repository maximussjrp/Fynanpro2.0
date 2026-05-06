/**
 * Partner audit logger — append-only.
 *
 * Princípios:
 *   - Recebe SEMPRE um TransactionClient (`tx`). O caller decide a transação;
 *     o helper apenas escreve. Isso garante que toda mudança de estado +
 *     auditoria caem juntas no MESMO commit (rollback atômico).
 *   - Não expõe update/delete. Append-only por design.
 *   - Whitelist explícita de subjectType (evita audit log "lixo").
 *   - Payload é um JSON de snapshot mínimo. Validamos a chave whitelist
 *     `payload` mas confiamos no caller; este helper não sanitiza PII —
 *     a responsabilidade é do caller (passar APENAS dados seguros).
 *
 * Fase 0.2 (Opção C): este helper só é usado para audits cujo enum já existe:
 *   - kyc_approved
 *   - kyc_rejected
 *   - referral_link_regenerated
 *
 * Os outros valores do enum PartnerAuditAction são aceitos pelo helper porque
 * existem no schema; ficarão dormentes até suas fases.
 */

import type { Prisma } from '@prisma/client';

/** SubjectTypes permitidos. Whitelist explícita. */
const ALLOWED_SUBJECT_TYPES = [
  'PartnerKyc',
  'ReferralLink',
  'ConsultantProfile',
  'Commission',
  'CommissionBatch',
  'Payout',
] as const;
export type PartnerAuditSubjectType = (typeof ALLOWED_SUBJECT_TYPES)[number];

/** Lista canônica de actions; espelha enum PartnerAuditAction do schema. */
export type PartnerAuditAction =
  | 'consultant_approved'
  | 'consultant_suspended'
  | 'consultant_banned'
  | 'sponsorship_changed'
  | 'bank_data_changed'
  | 'referral_link_regenerated'
  | 'client_list_exported'
  | 'commission_approved'
  | 'commission_blocked'
  | 'commission_reversed'
  | 'batch_closed'
  | 'batch_paid'
  | 'payout_marked_paid'
  | 'kyc_approved'
  | 'kyc_rejected';

/** Subset mínimo do client transacional usado pelo logger. */
export type AuditTxClient = Pick<Prisma.TransactionClient, 'partnerAuditLog'>;

export interface PartnerAuditEntry {
  action: PartnerAuditAction;
  actorUserId: string;
  subjectType: PartnerAuditSubjectType;
  subjectId: string;
  payload: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

export class PartnerAuditError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'PartnerAuditError';
  }
}

function isAllowedSubjectType(value: string): value is PartnerAuditSubjectType {
  return (ALLOWED_SUBJECT_TYPES as readonly string[]).includes(value);
}

export async function logPartnerAudit(
  tx: AuditTxClient,
  entry: PartnerAuditEntry,
): Promise<void> {
  if (!entry.action) {
    throw new PartnerAuditError('action é obrigatório', 'AUDIT_INVALID_INPUT');
  }
  if (!entry.actorUserId || entry.actorUserId.trim() === '') {
    throw new PartnerAuditError(
      'actorUserId é obrigatório',
      'AUDIT_INVALID_INPUT',
    );
  }
  if (!isAllowedSubjectType(entry.subjectType)) {
    throw new PartnerAuditError(
      `subjectType '${entry.subjectType}' não está na whitelist`,
      'AUDIT_INVALID_SUBJECT',
    );
  }
  if (!entry.subjectId || entry.subjectId.trim() === '') {
    throw new PartnerAuditError(
      'subjectId é obrigatório',
      'AUDIT_INVALID_INPUT',
    );
  }
  if (entry.payload == null || typeof entry.payload !== 'object') {
    throw new PartnerAuditError(
      'payload deve ser um objeto JSON',
      'AUDIT_INVALID_INPUT',
    );
  }

  await tx.partnerAuditLog.create({
    data: {
      action: entry.action as any,
      actorUserId: entry.actorUserId,
      subjectType: entry.subjectType,
      subjectId: entry.subjectId,
      payload: entry.payload as any,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
