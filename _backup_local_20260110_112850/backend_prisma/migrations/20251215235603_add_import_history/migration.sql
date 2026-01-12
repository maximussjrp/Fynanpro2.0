-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "importedFrom" TEXT;

-- CreateTable
CREATE TABLE "ImportHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "totalImported" INTEGER NOT NULL DEFAULT 0,
    "totalSkipped" INTEGER NOT NULL DEFAULT 0,
    "totalDuplicates" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportHistory_tenantId_createdAt_idx" ON "ImportHistory"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "ImportHistory" ADD CONSTRAINT "ImportHistory_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
