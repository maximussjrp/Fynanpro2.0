-- Ver TODAS as transações filhas das duas MEI Dandara (incluindo deletadas)
SELECT 
  "parentId",
  COUNT(*) as total,
  COUNT(CASE WHEN "deletedAt" IS NULL THEN 1 END) as ativos,
  COUNT(CASE WHEN "deletedAt" IS NOT NULL THEN 1 END) as deletados,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as pagos,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendentes
FROM "Transaction"
WHERE "tenantId" = '4c8ff719-5b7a-4b69-93fa-1aef7e2ad44d'
AND "parentId" IN (
  '6654229f-4496-4e54-995e-0928be849ee3',
  'c994c8b0-fed1-4338-876c-040c4a8f6592'
)
GROUP BY "parentId";

-- Ver detalhes das transações filhas ativas do parent ativo
SELECT 
  id,
  description,
  "transactionDate"::date,
  status,
  amount,
  "deletedAt"
FROM "Transaction"
WHERE "parentId" = 'c994c8b0-fed1-4338-876c-040c4a8f6592'
AND "deletedAt" IS NULL
ORDER BY "transactionDate";
