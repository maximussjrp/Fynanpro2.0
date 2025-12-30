-- Restaurar as transações pai que foram soft-deleted
UPDATE "Transaction"
SET "deletedAt" = NULL
WHERE id IN (
  '97f98016-f33f-40e9-b807-50fbff5f5952',  -- Semae
  '04e5f1de-14d8-455c-bf0c-320f6745bf74',  -- Desktop
  '6654229f-4496-4e54-995e-0928be849ee3',  -- MEI Dandara
  'c994c8b0-fed1-4338-876c-040c4a8f6592'   -- MEI Dandara 2
)
AND "tenantId" = '4c8ff719-5b7a-4b69-93fa-1aef7e2ad44d';

-- Verificar
SELECT id, description, amount, "deletedAt"
FROM "Transaction" 
WHERE id IN (
  '97f98016-f33f-40e9-b807-50fbff5f5952',
  '04e5f1de-14d8-455c-bf0c-320f6745bf74',
  '6654229f-4496-4e54-995e-0928be849ee3',
  'c994c8b0-fed1-4338-876c-040c4a8f6592'
);
