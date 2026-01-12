-- CreateIndex
CREATE INDEX "BankAccount_tenantId_type_idx" ON "BankAccount"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Budget_tenantId_isActive_startDate_idx" ON "Budget"("tenantId", "isActive", "startDate");

-- CreateIndex
CREATE INDEX "Budget_tenantId_period_isActive_idx" ON "Budget"("tenantId", "period", "isActive");

-- CreateIndex
CREATE INDEX "Category_tenantId_type_isActive_idx" ON "Category"("tenantId", "type", "isActive");

-- CreateIndex
CREATE INDEX "Category_tenantId_isActive_idx" ON "Category"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "Installment_tenantId_status_dueDate_idx" ON "Installment"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "InstallmentPurchase_tenantId_status_firstDueDate_idx" ON "InstallmentPurchase"("tenantId", "status", "firstDueDate");

-- CreateIndex
CREATE INDEX "PaymentMethod_tenantId_type_isActive_idx" ON "PaymentMethod"("tenantId", "type", "isActive");

-- CreateIndex
CREATE INDEX "RecurringBill_tenantId_status_dueDay_idx" ON "RecurringBill"("tenantId", "status", "dueDay");

-- CreateIndex
CREATE INDEX "RecurringBill_tenantId_type_status_idx" ON "RecurringBill"("tenantId", "type", "status");

-- CreateIndex
CREATE INDEX "RecurringBillOccurrence_tenantId_status_dueDate_idx" ON "RecurringBillOccurrence"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_isRevoked_expiresAt_idx" ON "RefreshToken"("userId", "isRevoked", "expiresAt");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_type_transactionDate_idx" ON "Transaction"("tenantId", "type", "transactionDate");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_status_transactionDate_idx" ON "Transaction"("tenantId", "status", "transactionDate");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_categoryId_transactionDate_idx" ON "Transaction"("tenantId", "categoryId", "transactionDate");

-- CreateIndex
CREATE INDEX "Transaction_bankAccountId_transactionDate_idx" ON "Transaction"("bankAccountId", "transactionDate");
