-- UTOP Partners — Fase 0 — Rollback
--
-- USAR SOMENTE se a Fase 0 precisar ser revertida ANTES da Fase 1.
-- Após Fase 1 entrar em produção (qualquer dado real gravado), NÃO rodar este script.
--
-- Drops em ordem reversa de dependência (filhos antes de pais).
-- Idempotente: usa IF EXISTS.
--
-- Pós-rollback: rodar `npx prisma migrate resolve --rolled-back 20260425_partners_phase0_foundation`
-- para que o Prisma marque a migration como revertida no _prisma_migrations.

BEGIN;

-- Tables (filhos primeiro)
DROP TABLE IF EXISTS "partner_consultant_bans"            CASCADE;
DROP TABLE IF EXISTS "partner_audit_logs"                 CASCADE;
DROP TABLE IF EXISTS "partner_kyc_documents"              CASCADE;
DROP TABLE IF EXISTS "partner_kyc"                        CASCADE;
DROP TABLE IF EXISTS "partner_wallet_entries"             CASCADE;
DROP TABLE IF EXISTS "partner_commission_batch_items"     CASCADE;
DROP TABLE IF EXISTS "partner_payouts"                    CASCADE;
DROP TABLE IF EXISTS "partner_commission_batches"         CASCADE;
DROP TABLE IF EXISTS "partner_commissions"                CASCADE;
DROP TABLE IF EXISTS "partner_certificates"               CASCADE;
DROP TABLE IF EXISTS "partner_enrollments"                CASCADE;
DROP TABLE IF EXISTS "partner_courses"                    CASCADE;
DROP TABLE IF EXISTS "partner_sponsorship_edges"          CASCADE;
DROP TABLE IF EXISTS "partner_referral_attributions"      CASCADE;
DROP TABLE IF EXISTS "partner_referral_links"             CASCADE;

-- ENUMs
DROP TYPE IF EXISTS "PartnerAuditAction";
DROP TYPE IF EXISTS "BanReason";
DROP TYPE IF EXISTS "KycDocumentType";
DROP TYPE IF EXISTS "KycStatus";
DROP TYPE IF EXISTS "EnrollmentStatus";
DROP TYPE IF EXISTS "WalletEntryReason";
DROP TYPE IF EXISTS "PayoutStatus";
DROP TYPE IF EXISTS "CommissionBatchStatus";
DROP TYPE IF EXISTS "CommissionBlockReason";
DROP TYPE IF EXISTS "CommissionStatus";
DROP TYPE IF EXISTS "CommissionEventType";
DROP TYPE IF EXISTS "AttributionTargetType";
DROP TYPE IF EXISTS "AttributionType";

COMMIT;
