ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "occurrenceNumber" INTEGER;
SELECT 'occurrenceNumber added' as status;
