-- CreateIndex
CREATE INDEX "Transaction_tenantId_status_idx" ON "Transaction"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Transaction_status_transactionDate_idx" ON "Transaction"("status", "transactionDate");

-- CreateIndex
CREATE INDEX "Transaction_recurringBillId_idx" ON "Transaction"("recurringBillId");

-- CreateIndex
CREATE INDEX "Transaction_installmentPurchaseId_idx" ON "Transaction"("installmentPurchaseId");
