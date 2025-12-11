-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "path" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "alertDaysBefore" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "autoGenerateNext" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "downPaymentAmount" DECIMAL(15,2),
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "frequency" TEXT,
ADD COLUMN     "frequencyInterval" INTEGER,
ADD COLUMN     "hasDownPayment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "installmentNumber" INTEGER,
ADD COLUMN     "nextDueDate" TIMESTAMP(3),
ADD COLUMN     "occurrenceNumber" INTEGER,
ADD COLUMN     "originalAmount" DECIMAL(15,2),
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "totalInstallments" INTEGER,
ADD COLUMN     "totalOccurrences" INTEGER,
ADD COLUMN     "transactionType" TEXT NOT NULL DEFAULT 'single';

-- CreateIndex
CREATE INDEX "Category_path_idx" ON "Category"("path");

-- CreateIndex
CREATE INDEX "Transaction_parentId_idx" ON "Transaction"("parentId");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_transactionType_status_idx" ON "Transaction"("tenantId", "transactionType", "status");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_nextDueDate_idx" ON "Transaction"("tenantId", "nextDueDate");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Transaction"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
