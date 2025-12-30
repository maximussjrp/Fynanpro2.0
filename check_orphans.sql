-- Ver todas as transações FILHAS que estão deletadas mas cujo parent ainda está ativo
-- (isso seria um bug - transações órfãs)
SELECT 
  t.id,
  t.description,
  t."transactionDate"::date,
  t.status,
  t."deletedAt",
  p.description as parent_description,
  p."deletedAt" as parent_deletedAt
FROM "Transaction" t
LEFT JOIN "Transaction" p ON p.id = t."parentId"
WHERE t."tenantId" = '4c8ff719-5b7a-4b69-93fa-1aef7e2ad44d'
AND t."parentId" IS NOT NULL
AND t."deletedAt" IS NOT NULL
AND p."deletedAt" IS NULL;

-- Contar quantas transações pai ativas existem por nome
SELECT 
  description,
  COUNT(*) as total_ativos,
  array_agg(id) as ids
FROM "Transaction"
WHERE "tenantId" = '4c8ff719-5b7a-4b69-93fa-1aef7e2ad44d'
AND "parentId" IS NULL
AND "deletedAt" IS NULL
GROUP BY description
ORDER BY total_ativos DESC, description;
