-- Ver TODAS transações de janeiro 2026 (incluindo scheduled)
SELECT 
  id,
  description,
  "transactionDate"::date,
  status,
  "parentId",
  CASE WHEN "parentId" IS NULL THEN 'PAI' ELSE 'FILHA' END as tipo
FROM "Transaction"
WHERE "tenantId" = '4c8ff719-5b7a-4b69-93fa-1aef7e2ad44d'
AND "deletedAt" IS NULL
AND "transactionDate" >= '2026-01-01'
AND "transactionDate" < '2026-02-01'
ORDER BY "transactionDate", description;
