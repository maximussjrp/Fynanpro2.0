-- Verificar transações duplicadas na data 20/01/2026
SELECT 
  id, 
  description, 
  amount, 
  "parentId",
  "transactionDate",
  status,
  "deletedAt"
FROM "Transaction"
WHERE "tenantId" = '4c8ff719-5b7a-4b69-93fa-1aef7e2ad44d'
AND description = 'MEI Dandara'
AND "transactionDate"::date = '2026-01-20'
ORDER BY "createdAt";

-- Ver todas as transações pai com nome duplicado
SELECT 
  description, 
  COUNT(*) as total,
  COUNT(CASE WHEN "deletedAt" IS NULL THEN 1 END) as ativos,
  COUNT(CASE WHEN "deletedAt" IS NOT NULL THEN 1 END) as deletados
FROM "Transaction"
WHERE "tenantId" = '4c8ff719-5b7a-4b69-93fa-1aef7e2ad44d'
AND "parentId" IS NULL
GROUP BY description
HAVING COUNT(*) > 1;

-- Ver todas as transações pai (ativas e deletadas)
SELECT 
  id,
  description,
  amount,
  "deletedAt",
  "createdAt"
FROM "Transaction"
WHERE "tenantId" = '4c8ff719-5b7a-4b69-93fa-1aef7e2ad44d'
AND "parentId" IS NULL
ORDER BY description, "createdAt";
