/*
  Warnings:

  - A unique constraint covering the columns `[recurringBillId,dueDate]` on the table `RecurringBillOccurrence` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "RecurringBillOccurrence_recurringBillId_dueDate_key" ON "RecurringBillOccurrence"("recurringBillId", "dueDate");
