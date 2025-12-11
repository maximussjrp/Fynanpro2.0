/*
  Warnings:

  - You are about to drop the column `installmentNumber` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `installmentPurchaseId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `paidAmount` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `Transaction` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_installmentPurchaseId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_recurringBillId_fkey";

-- DropIndex
DROP INDEX "Transaction_installmentPurchaseId_idx";

-- DropIndex
DROP INDEX "Transaction_status_transactionDate_idx";

-- DropIndex
DROP INDEX "Transaction_tenantId_status_idx";

-- AlterTable
ALTER TABLE "InstallmentPurchase" ADD COLUMN     "isFixed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "actionUrl" TEXT,
ADD COLUMN     "transactionId" TEXT;

-- AlterTable
ALTER TABLE "RecurringBill" ADD COLUMN     "isFixed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "monthsAhead" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "installmentNumber",
DROP COLUMN "installmentPurchaseId",
DROP COLUMN "paidAmount",
DROP COLUMN "paidAt",
ADD COLUMN     "daysEarlyLate" INTEGER,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "installmentId" TEXT,
ADD COLUMN     "isFixed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isPaidEarly" BOOLEAN,
ADD COLUMN     "isPaidLate" BOOLEAN,
ADD COLUMN     "paidDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RecurringBillOccurrence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recurringBillId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "paidAmount" DECIMAL(15,2),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringBillOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "installmentPurchaseId" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "paymentMethodId" TEXT,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "paidAmount" DECIMAL(15,2),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringBillOccurrence_tenantId_dueDate_status_idx" ON "RecurringBillOccurrence"("tenantId", "dueDate", "status");

-- CreateIndex
CREATE INDEX "RecurringBillOccurrence_recurringBillId_idx" ON "RecurringBillOccurrence"("recurringBillId");

-- CreateIndex
CREATE INDEX "RecurringBillOccurrence_tenantId_status_dueDate_idx" ON "RecurringBillOccurrence"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Installment_tenantId_dueDate_status_idx" ON "Installment"("tenantId", "dueDate", "status");

-- CreateIndex
CREATE INDEX "Installment_installmentPurchaseId_idx" ON "Installment"("installmentPurchaseId");

-- CreateIndex
CREATE INDEX "Installment_tenantId_status_dueDate_idx" ON "Installment"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "InstallmentPurchase_tenantId_isFixed_status_idx" ON "InstallmentPurchase"("tenantId", "isFixed", "status");

-- CreateIndex
CREATE INDEX "Notification_tenantId_isRead_createdAt_idx" ON "Notification"("tenantId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_isRead_idx" ON "Notification"("type", "isRead");

-- CreateIndex
CREATE INDEX "RecurringBill_tenantId_isFixed_status_idx" ON "RecurringBill"("tenantId", "isFixed", "status");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_dueDate_status_idx" ON "Transaction"("tenantId", "dueDate", "status");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_isFixed_status_idx" ON "Transaction"("tenantId", "isFixed", "status");

-- AddForeignKey
ALTER TABLE "RecurringBillOccurrence" ADD CONSTRAINT "RecurringBillOccurrence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringBillOccurrence" ADD CONSTRAINT "RecurringBillOccurrence_recurringBillId_fkey" FOREIGN KEY ("recurringBillId") REFERENCES "RecurringBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_installmentPurchaseId_fkey" FOREIGN KEY ("installmentPurchaseId") REFERENCES "InstallmentPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
