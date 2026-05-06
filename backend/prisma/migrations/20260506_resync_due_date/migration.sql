-- Resync dueDate <- transactionDate em transações ainda não pagas onde
-- o reagendamento via app moveu apenas transactionDate, deixando dueDate
-- defasado e fazendo o badge "Atrasado" disparar incorretamente.
--
-- Critério: status != 'completed' E dueDate diferente de transactionDate.
-- Não toca em transações pagas (dueDate é histórico).
-- Não toca em transações onde dueDate já está alinhado.

UPDATE "Transaction"
SET "dueDate" = "transactionDate",
    "updatedAt" = NOW()
WHERE "deletedAt" IS NULL
  AND "status" <> 'completed'
  AND "dueDate" IS DISTINCT FROM "transactionDate";
