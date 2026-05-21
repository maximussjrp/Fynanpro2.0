CREATE TABLE "TransactionCategorySplit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionCategorySplit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransactionCategorySplit_tenantId_categoryId_idx" ON "TransactionCategorySplit"("tenantId", "categoryId");
CREATE INDEX "TransactionCategorySplit_tenantId_transactionId_idx" ON "TransactionCategorySplit"("tenantId", "transactionId");
CREATE INDEX "TransactionCategorySplit_transactionId_idx" ON "TransactionCategorySplit"("transactionId");

ALTER TABLE "TransactionCategorySplit" ADD CONSTRAINT "TransactionCategorySplit_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionCategorySplit" ADD CONSTRAINT "TransactionCategorySplit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionCategorySplit" ADD CONSTRAINT "TransactionCategorySplit_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
