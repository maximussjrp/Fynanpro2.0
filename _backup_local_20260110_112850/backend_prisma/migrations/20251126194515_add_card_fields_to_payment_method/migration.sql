-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN     "cardNetwork" TEXT,
ADD COLUMN     "expirationDate" TIMESTAMP(3);
