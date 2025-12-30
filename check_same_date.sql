-- Verificar se há transações ATIVAS duplicadas na mesma data
SELECT 
  description,
  "transactionDate"::date as data,
  COUNT(*) as quantidade,
  array_agg(id) as ids,
  array_agg(status) as status_list
FROM "Transaction"
WHERE "tenantId" = '4c8ff719-5b7a-4b69-93fa-1aef7e2ad44d'
AND "deletedAt" IS NULL
AND "parentId" IS NOT NULL
GROUP BY description, "transactionDate"::date
HAVING COUNT(*) > 1
ORDER BY "transactionDate"::date, description;
