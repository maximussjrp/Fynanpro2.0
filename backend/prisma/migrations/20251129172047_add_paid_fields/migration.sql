-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "paidAmount" DECIMAL(15,2),
ADD COLUMN     "paidAt" TIMESTAMP(3);
