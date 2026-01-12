-- AlterTable
ALTER TABLE "RecurringBillOccurrence" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "RecurringBillOccurrence_tenantId_deletedAt_idx" ON "RecurringBillOccurrence"("tenantId", "deletedAt");
