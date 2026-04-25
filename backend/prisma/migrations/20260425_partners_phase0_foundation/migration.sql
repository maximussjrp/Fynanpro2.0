-- UTOP Partners — Fase 0 (Foundation)
--
-- 100% aditiva. Zero alteração em tabelas existentes.
-- Nenhuma feature flag é ativada por esta migration.
-- FF_PARTNERS_ENABLED permanece OFF em prod até ordem explícita.
--
-- Roadmap: docs/revendedores-plano.md
-- Decisões cravadas: §0 do roadmap
-- Refinamentos de modelagem: §1.4 do roadmap
--
-- Pós-migration (rodar separado, fora de transação):
--   migrations/20260425_partners_phase0_foundation/postmigration.sql
-- Rollback (se necessário antes da Fase 1):
--   migrations/20260425_partners_phase0_foundation/rollback_phase0.sql

-- =====================================================================
-- ENUMs
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE "AttributionType" AS ENUM ('client_signup', 'consultant_signup', 'manual_admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AttributionTargetType" AS ENUM ('client', 'consultant');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionEventType" AS ENUM ('curso', 'primeira_mensalidade', 'recorrente', 'upgrade');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionStatus" AS ENUM ('em_hold', 'aprovada', 'paga', 'bloqueada', 'estornada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionBlockReason" AS ENUM (
    'consultor_inadimplente',
    'consultor_nao_certificado',
    'kyc_pendente',
    'dados_bancarios_pendentes',
    'suspeita_fraude',
    'cliente_em_disputa',
    'upline_inativo'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionBatchStatus" AS ENUM ('aberto', 'fechado', 'pago', 'cancelado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('pendente', 'exportado', 'pago', 'falhou');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "WalletEntryReason" AS ENUM ('commission_paid', 'chargeback_debit', 'payout', 'manual_adjustment');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "EnrollmentStatus" AS ENUM ('nao_iniciada', 'em_andamento', 'concluida', 'certificada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "KycStatus" AS ENUM ('pendente', 'em_analise', 'aprovado', 'rejeitado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "KycDocumentType" AS ENUM ('rg', 'cpf', 'comprovante_endereco', 'selfie');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "BanReason" AS ENUM (
    'fraude_comprovada',
    'chargeback_malicioso',
    'falsidade_cadastral',
    'violacao_conduta_grave',
    'manipulacao_rede_ou_comissao'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PartnerAuditAction" AS ENUM (
    'consultant_approved',
    'consultant_suspended',
    'consultant_banned',
    'sponsorship_changed',
    'bank_data_changed',
    'referral_link_regenerated',
    'client_list_exported',
    'commission_approved',
    'commission_blocked',
    'commission_reversed',
    'batch_closed',
    'batch_paid',
    'payout_marked_paid',
    'kyc_approved',
    'kyc_rejected'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =====================================================================
-- TABLES
-- =====================================================================

-- partner_referral_links
CREATE TABLE "partner_referral_links" (
  "id"            TEXT PRIMARY KEY,
  "consultantId"  TEXT NOT NULL,
  "slug"          TEXT NOT NULL,
  "active"        BOOLEAN NOT NULL DEFAULT true,
  "regeneratedAt" TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "partner_referral_links_slug_key" ON "partner_referral_links"("slug");
CREATE INDEX "partner_referral_links_consultantId_idx" ON "partner_referral_links"("consultantId");
CREATE INDEX "partner_referral_links_active_idx" ON "partner_referral_links"("active");

-- partner_referral_attributions
CREATE TABLE "partner_referral_attributions" (
  "id"                      TEXT PRIMARY KEY,
  "attributionType"         "AttributionType"      NOT NULL,
  "targetType"              "AttributionTargetType" NOT NULL,
  "targetUserId"            TEXT NOT NULL,
  "consultantId"            TEXT NOT NULL,
  "linkId"                  TEXT,
  "ip"                      TEXT,
  "userAgent"               VARCHAR(512),
  "attributedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reattributionEligibleAt" TIMESTAMP(3),
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "partner_referral_attributions_targetType_targetUserId_key"
  ON "partner_referral_attributions"("targetType", "targetUserId");
CREATE INDEX "partner_referral_attributions_consultantId_idx" ON "partner_referral_attributions"("consultantId");
CREATE INDEX "partner_referral_attributions_attributedAt_idx" ON "partner_referral_attributions"("attributedAt");

-- partner_sponsorship_edges
CREATE TABLE "partner_sponsorship_edges" (
  "id"                   TEXT PRIMARY KEY,
  "consultantId"         TEXT NOT NULL,
  "sponsorConsultantId"  TEXT,
  "changedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changedByAdminUserId" TEXT,
  "changeReason"         VARCHAR(500),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "partner_sponsorship_edges_consultantId_key" ON "partner_sponsorship_edges"("consultantId");
CREATE INDEX "partner_sponsorship_edges_sponsorConsultantId_idx" ON "partner_sponsorship_edges"("sponsorConsultantId");

-- partner_courses
CREATE TABLE "partner_courses" (
  "id"         TEXT PRIMARY KEY,
  "name"       TEXT NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "active"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL
);

-- partner_enrollments
CREATE TABLE "partner_enrollments" (
  "id"              TEXT PRIMARY KEY,
  "consultantId"    TEXT NOT NULL,
  "courseId"        TEXT NOT NULL,
  "status"          "EnrollmentStatus" NOT NULL DEFAULT 'nao_iniciada',
  "progressPct"     INTEGER NOT NULL DEFAULT 0,
  "startedAt"       TIMESTAMP(3),
  "completedAt"     TIMESTAMP(3),
  "paymentRecordId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "partner_enrollments_paymentRecordId_key" ON "partner_enrollments"("paymentRecordId");
CREATE UNIQUE INDEX "partner_enrollments_consultantId_courseId_key"
  ON "partner_enrollments"("consultantId", "courseId");
CREATE INDEX "partner_enrollments_status_idx" ON "partner_enrollments"("status");

-- partner_certificates
CREATE TABLE "partner_certificates" (
  "id"           TEXT PRIMARY KEY,
  "enrollmentId" TEXT NOT NULL,
  "code"         TEXT NOT NULL,
  "issuedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "partner_certificates_enrollmentId_key" ON "partner_certificates"("enrollmentId");
CREATE UNIQUE INDEX "partner_certificates_code_key" ON "partner_certificates"("code");

-- partner_commissions
CREATE TABLE "partner_commissions" (
  "id"                      TEXT PRIMARY KEY,
  "paymentRecordId"         TEXT NOT NULL,
  "beneficiaryConsultantId" TEXT NOT NULL,
  "level"                   INTEGER NOT NULL,
  "eventType"               "CommissionEventType" NOT NULL,
  "percentBps"              INTEGER NOT NULL,
  "amountCents"             INTEGER NOT NULL,
  "status"                  "CommissionStatus" NOT NULL DEFAULT 'em_hold',
  "blockReason"             "CommissionBlockReason",
  "holdUntil"               TIMESTAMP(3) NOT NULL,
  "approvedAt"              TIMESTAMP(3),
  "paidAt"                  TIMESTAMP(3),
  "reversedAt"              TIMESTAMP(3),
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "partner_commissions_paymentRecordId_beneficiaryConsultantId_level_key"
  ON "partner_commissions"("paymentRecordId", "beneficiaryConsultantId", "level");
CREATE INDEX "partner_commissions_status_holdUntil_idx" ON "partner_commissions"("status", "holdUntil");
CREATE INDEX "partner_commissions_beneficiaryConsultantId_status_idx"
  ON "partner_commissions"("beneficiaryConsultantId", "status");
CREATE INDEX "partner_commissions_paymentRecordId_idx" ON "partner_commissions"("paymentRecordId");

-- partner_commission_batches
CREATE TABLE "partner_commission_batches" (
  "id"                  TEXT PRIMARY KEY,
  "referenceMonth"      TEXT NOT NULL,
  "status"              "CommissionBatchStatus" NOT NULL DEFAULT 'aberto',
  "totalCents"          INTEGER NOT NULL DEFAULT 0,
  "closedAt"            TIMESTAMP(3),
  "paidAt"              TIMESTAMP(3),
  "closedByAdminUserId" TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "partner_commission_batches_referenceMonth_key"
  ON "partner_commission_batches"("referenceMonth");
CREATE INDEX "partner_commission_batches_status_idx" ON "partner_commission_batches"("status");

-- partner_payouts
CREATE TABLE "partner_payouts" (
  "id"              TEXT PRIMARY KEY,
  "batchId"         TEXT NOT NULL,
  "consultantId"    TEXT NOT NULL,
  "amountCents"     INTEGER NOT NULL,
  "pixKey"          VARCHAR(140) NOT NULL,
  "pixKeyType"      VARCHAR(20)  NOT NULL,
  "status"          "PayoutStatus" NOT NULL DEFAULT 'pendente',
  "asaasTransferId" TEXT,
  "paidAt"          TIMESTAMP(3),
  "failureReason"   VARCHAR(500),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "partner_payouts_batchId_consultantId_key"
  ON "partner_payouts"("batchId", "consultantId");
CREATE INDEX "partner_payouts_status_idx"       ON "partner_payouts"("status");
CREATE INDEX "partner_payouts_consultantId_idx" ON "partner_payouts"("consultantId");

-- partner_commission_batch_items
CREATE TABLE "partner_commission_batch_items" (
  "id"           TEXT PRIMARY KEY,
  "batchId"      TEXT NOT NULL,
  "commissionId" TEXT NOT NULL,
  "payoutId"     TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "partner_commission_batch_items_commissionId_key"
  ON "partner_commission_batch_items"("commissionId");
CREATE INDEX "partner_commission_batch_items_batchId_idx"  ON "partner_commission_batch_items"("batchId");
CREATE INDEX "partner_commission_batch_items_payoutId_idx" ON "partner_commission_batch_items"("payoutId");

-- partner_wallet_entries
CREATE TABLE "partner_wallet_entries" (
  "id"                   TEXT PRIMARY KEY,
  "consultantId"         TEXT NOT NULL,
  "deltaCents"           INTEGER NOT NULL,
  "reason"               "WalletEntryReason" NOT NULL,
  "refType"              VARCHAR(40) NOT NULL,
  "refId"                TEXT,
  "payoutId"             TEXT,
  "description"          VARCHAR(500),
  "createdByAdminUserId" TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "partner_wallet_entries_consultantId_createdAt_idx"
  ON "partner_wallet_entries"("consultantId", "createdAt");
CREATE INDEX "partner_wallet_entries_reason_idx" ON "partner_wallet_entries"("reason");

-- partner_kyc
CREATE TABLE "partner_kyc" (
  "id"                    TEXT PRIMARY KEY,
  "consultantId"          TEXT NOT NULL,
  "status"                "KycStatus" NOT NULL DEFAULT 'pendente',
  "reviewedAt"            TIMESTAMP(3),
  "reviewedByAdminUserId" TEXT,
  "rejectReason"          VARCHAR(500),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "partner_kyc_consultantId_key" ON "partner_kyc"("consultantId");
CREATE INDEX "partner_kyc_status_idx" ON "partner_kyc"("status");

-- partner_kyc_documents
CREATE TABLE "partner_kyc_documents" (
  "id"               TEXT PRIMARY KEY,
  "kycId"            TEXT NOT NULL,
  "type"             "KycDocumentType" NOT NULL,
  "storageKey"       VARCHAR(500) NOT NULL,
  "originalFileName" VARCHAR(255),
  "mimeType"         VARCHAR(100) NOT NULL,
  "sizeBytes"        INTEGER NOT NULL,
  "checksumSha256"   VARCHAR(64),
  "uploadedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "partner_kyc_documents_kycId_idx"          ON "partner_kyc_documents"("kycId");
CREATE INDEX "partner_kyc_documents_checksumSha256_idx" ON "partner_kyc_documents"("checksumSha256");

-- partner_audit_logs
CREATE TABLE "partner_audit_logs" (
  "id"          TEXT PRIMARY KEY,
  "action"      "PartnerAuditAction" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "subjectType" VARCHAR(40) NOT NULL,
  "subjectId"   TEXT NOT NULL,
  "payload"     JSONB NOT NULL,
  "ip"          TEXT,
  "userAgent"   VARCHAR(512),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "partner_audit_logs_subjectType_subjectId_idx"
  ON "partner_audit_logs"("subjectType", "subjectId");
CREATE INDEX "partner_audit_logs_action_createdAt_idx"
  ON "partner_audit_logs"("action", "createdAt");
CREATE INDEX "partner_audit_logs_actorUserId_createdAt_idx"
  ON "partner_audit_logs"("actorUserId", "createdAt");

-- partner_consultant_bans
CREATE TABLE "partner_consultant_bans" (
  "id"                  TEXT PRIMARY KEY,
  "consultantId"        TEXT NOT NULL,
  "reason"              "BanReason" NOT NULL,
  "notes"               VARCHAR(1000) NOT NULL,
  "bannedByAdminUserId" TEXT NOT NULL,
  "bannedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "partner_consultant_bans_consultantId_key"
  ON "partner_consultant_bans"("consultantId");

-- =====================================================================
-- FOREIGN KEYS
-- =====================================================================

ALTER TABLE "partner_referral_links"
  ADD CONSTRAINT "partner_referral_links_consultantId_fkey"
  FOREIGN KEY ("consultantId") REFERENCES "ConsultantProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "partner_referral_attributions"
  ADD CONSTRAINT "partner_referral_attributions_consultantId_fkey"
  FOREIGN KEY ("consultantId") REFERENCES "ConsultantProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "partner_referral_attributions"
  ADD CONSTRAINT "partner_referral_attributions_linkId_fkey"
  FOREIGN KEY ("linkId") REFERENCES "partner_referral_links"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "partner_sponsorship_edges"
  ADD CONSTRAINT "partner_sponsorship_edges_consultantId_fkey"
  FOREIGN KEY ("consultantId") REFERENCES "ConsultantProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "partner_sponsorship_edges"
  ADD CONSTRAINT "partner_sponsorship_edges_sponsorConsultantId_fkey"
  FOREIGN KEY ("sponsorConsultantId") REFERENCES "ConsultantProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "partner_enrollments"
  ADD CONSTRAINT "partner_enrollments_consultantId_fkey"
  FOREIGN KEY ("consultantId") REFERENCES "ConsultantProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "partner_enrollments"
  ADD CONSTRAINT "partner_enrollments_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "partner_courses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "partner_certificates"
  ADD CONSTRAINT "partner_certificates_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "partner_enrollments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "partner_commissions"
  ADD CONSTRAINT "partner_commissions_beneficiaryConsultantId_fkey"
  FOREIGN KEY ("beneficiaryConsultantId") REFERENCES "ConsultantProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "partner_commission_batch_items"
  ADD CONSTRAINT "partner_commission_batch_items_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "partner_commission_batches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "partner_commission_batch_items"
  ADD CONSTRAINT "partner_commission_batch_items_commissionId_fkey"
  FOREIGN KEY ("commissionId") REFERENCES "partner_commissions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "partner_commission_batch_items"
  ADD CONSTRAINT "partner_commission_batch_items_payoutId_fkey"
  FOREIGN KEY ("payoutId") REFERENCES "partner_payouts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "partner_payouts"
  ADD CONSTRAINT "partner_payouts_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "partner_commission_batches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "partner_payouts"
  ADD CONSTRAINT "partner_payouts_consultantId_fkey"
  FOREIGN KEY ("consultantId") REFERENCES "ConsultantProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "partner_wallet_entries"
  ADD CONSTRAINT "partner_wallet_entries_consultantId_fkey"
  FOREIGN KEY ("consultantId") REFERENCES "ConsultantProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "partner_wallet_entries"
  ADD CONSTRAINT "partner_wallet_entries_payoutId_fkey"
  FOREIGN KEY ("payoutId") REFERENCES "partner_payouts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "partner_kyc"
  ADD CONSTRAINT "partner_kyc_consultantId_fkey"
  FOREIGN KEY ("consultantId") REFERENCES "ConsultantProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "partner_kyc_documents"
  ADD CONSTRAINT "partner_kyc_documents_kycId_fkey"
  FOREIGN KEY ("kycId") REFERENCES "partner_kyc"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "partner_consultant_bans"
  ADD CONSTRAINT "partner_consultant_bans_consultantId_fkey"
  FOREIGN KEY ("consultantId") REFERENCES "ConsultantProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
