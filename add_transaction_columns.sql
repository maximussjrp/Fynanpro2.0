-- Adicionar campos para transações recorrentes e parceladas
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "transactionType" VARCHAR(50) DEFAULT 'single';
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "originalAmount" DECIMAL(15,2);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "parentId" VARCHAR(255);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "frequency" VARCHAR(50);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "frequencyInterval" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "totalOccurrences" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "currentOccurrence" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "nextDueDate" TIMESTAMP;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "alertDaysBefore" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "autoGenerateNext" BOOLEAN;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "totalInstallments" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "installmentNumber" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "hasDownPayment" BOOLEAN;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "downPaymentAmount" DECIMAL(15,2);

-- Criar índices
CREATE INDEX IF NOT EXISTS "Transaction_parentId_idx" ON "Transaction"("parentId");
CREATE INDEX IF NOT EXISTS "Transaction_transactionType_idx" ON "Transaction"("transactionType");
CREATE INDEX IF NOT EXISTS "Transaction_tenantId_transactionType_status_idx" ON "Transaction"("tenantId", "transactionType", "status");

-- Verificar
SELECT column_name FROM information_schema.columns WHERE table_name = 'Transaction' AND column_name = 'transactionType';
