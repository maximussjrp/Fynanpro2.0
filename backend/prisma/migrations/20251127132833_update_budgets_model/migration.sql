/*
  Warnings:

  - You are about to drop the column `blockAtLimit` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `limitAmount` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `percentageUsed` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `referenceMonth` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `spentAmount` on the `Budget` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Budget` table. All the data in the column will be lost.
  - Added the required column `amount` to the `Budget` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endDate` to the `Budget` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Budget` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `Budget` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Budget_tenantId_categoryId_referenceMonth_key";

-- DropIndex
DROP INDEX "Budget_tenantId_referenceMonth_idx";

-- AlterTable
ALTER TABLE "Budget" DROP COLUMN "blockAtLimit",
DROP COLUMN "limitAmount",
DROP COLUMN "notes",
DROP COLUMN "percentageUsed",
DROP COLUMN "referenceMonth",
DROP COLUMN "spentAmount",
DROP COLUMN "status",
ADD COLUMN     "alertAt90" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "amount" DECIMAL(15,2) NOT NULL,
ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "period" TEXT NOT NULL DEFAULT 'monthly',
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Budget_tenantId_categoryId_isActive_idx" ON "Budget"("tenantId", "categoryId", "isActive");

-- CreateIndex
CREATE INDEX "Budget_startDate_endDate_idx" ON "Budget"("startDate", "endDate");
