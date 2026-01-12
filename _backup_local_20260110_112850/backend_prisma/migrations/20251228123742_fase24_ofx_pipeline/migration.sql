-- FASE 2.4: OFX Pipeline com Transfer Detection e Anti-duplicação
-- Adiciona campos para import tracking, transfer detection, e review

-- =====================================================
-- Transaction: Campos de Import Tracking
-- =====================================================
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "importBatchId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "importSource" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "externalFitId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "rawDescription" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "normalizedDescription" TEXT;

-- =====================================================
-- Transaction: Campos de Transfer Detection
-- =====================================================
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "isTransfer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "transferGroupId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "linkedTransactionId" TEXT;

-- =====================================================
-- Transaction: Classification
-- =====================================================
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "transactionKind" TEXT NOT NULL DEFAULT 'bank';

-- =====================================================
-- Transaction: Energy Exclusion
-- =====================================================
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "excludedFromEnergy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "excludedReason" TEXT;

-- =====================================================
-- Transaction: Review Status
-- =====================================================
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "needsReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "reviewSuggestion" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;

-- =====================================================
-- Import: Estatísticas Expandidas
-- =====================================================
ALTER TABLE "Import" ADD COLUMN IF NOT EXISTS "bankAccountId" TEXT;
ALTER TABLE "Import" ADD COLUMN IF NOT EXISTS "createdCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Import" ADD COLUMN IF NOT EXISTS "dedupedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Import" ADD COLUMN IF NOT EXISTS "transferPairs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Import" ADD COLUMN IF NOT EXISTS "invoicePayments" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Import" ADD COLUMN IF NOT EXISTS "needsReviewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Import" ADD COLUMN IF NOT EXISTS "excludedFromEnergyCount" INTEGER NOT NULL DEFAULT 0;

-- =====================================================
-- Índices para OFX Import
-- =====================================================
CREATE INDEX IF NOT EXISTS "Transaction_tenantId_externalFitId_idx" ON "Transaction"("tenantId", "externalFitId");
CREATE INDEX IF NOT EXISTS "Transaction_tenantId_importBatchId_idx" ON "Transaction"("tenantId", "importBatchId");
CREATE INDEX IF NOT EXISTS "Transaction_tenantId_isTransfer_idx" ON "Transaction"("tenantId", "isTransfer");
CREATE INDEX IF NOT EXISTS "Transaction_tenantId_excludedFromEnergy_idx" ON "Transaction"("tenantId", "excludedFromEnergy");
CREATE INDEX IF NOT EXISTS "Transaction_tenantId_needsReview_idx" ON "Transaction"("tenantId", "needsReview");
CREATE INDEX IF NOT EXISTS "Transaction_transferGroupId_idx" ON "Transaction"("transferGroupId");
