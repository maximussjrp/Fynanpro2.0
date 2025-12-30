-- Buscar transações pai (recorrentes)
SELECT id, description, amount, type, "parentId"
FROM "Transaction" 
WHERE "tenantId" = '4c8ff719-5b7a-4b69-93fa-1aef7e2ad44d' 
AND "parentId" IS NULL
AND id IN (SELECT DISTINCT "parentId" FROM "Transaction" WHERE "parentId" IS NOT NULL)
LIMIT 10;
