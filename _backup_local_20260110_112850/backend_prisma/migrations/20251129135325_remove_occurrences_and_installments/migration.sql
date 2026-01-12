/*
  Warnings:

  - You are about to drop the column `installmentId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the `Installment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecurringBillOccurrence` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Installment" DROP CONSTRAINT "Installment_bankAccountId_fkey";

-- DropForeignKey
ALTER TABLE "Installment" DROP CONSTRAINT "Installment_installmentPurchaseId_fkey";

-- DropForeignKey
ALTER TABLE "Installment" DROP CONSTRAINT "Installment_paymentMethodId_fkey";

-- DropForeignKey
ALTER TABLE "Installment" DROP CONSTRAINT "Installment_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "RecurringBillOccurrence" DROP CONSTRAINT "RecurringBillOccurrence_recurringBillId_fkey";

-- DropForeignKey
ALTER TABLE "RecurringBillOccurrence" DROP CONSTRAINT "RecurringBillOccurrence_tenantId_fkey";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "installmentId",
ADD COLUMN     "installmentNumber" INTEGER,
ADD COLUMN     "installmentPurchaseId" TEXT;

-- DropTable
DROP TABLE "Installment";

-- DropTable
DROP TABLE "RecurringBillOccurrence";

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recurringBillId_fkey" FOREIGN KEY ("recurringBillId") REFERENCES "RecurringBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_installmentPurchaseId_fkey" FOREIGN KEY ("installmentPurchaseId") REFERENCES "InstallmentPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
