-- Verificar status de todas as transações pai
SELECT id, description, amount, "deletedAt"
FROM "Transaction" 
WHERE id IN (
  '97f98016-f33f-40e9-b807-50fbff5f5952',
  '04e5f1de-14d8-455c-bf0c-320f6745bf74',
  '6654229f-4496-4e54-995e-0928be849ee3',
  'c994c8b0-fed1-4338-876c-040c4a8f6592'
);
