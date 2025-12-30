-- Marcar 3 transações filhas da MEI Dandara como completed/paid
UPDATE "Transaction"
SET status = 'completed'
WHERE id IN (
  SELECT id FROM "Transaction"
  WHERE "parentId" = '6654229f-4496-4e54-995e-0928be849ee3'
  AND "tenantId" = '4c8ff719-5b7a-4b69-93fa-1aef7e2ad44d'
  AND status = 'pending'
  ORDER BY "transactionDate"
  LIMIT 3
);

-- Verificar
SELECT id, description, status, "transactionDate"
FROM "Transaction" 
WHERE "parentId" = '6654229f-4496-4e54-995e-0928be849ee3'
ORDER BY "transactionDate"
LIMIT 8;
