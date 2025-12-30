-- Buscar transações pai (recorrentes)
SELECT id, description, amount, type, "isParent"
FROM "Transaction" 
WHERE "tenantId" = '4c8ff719-5b7a-4b69-93fa-1aef7e2ad44d' 
AND "isParent" = true
LIMIT 10;

-- Buscar todas transações com parent
SELECT COUNT(*) as total_com_parent
FROM "Transaction" 
WHERE "tenantId" = '4c8ff719-5b7a-4b69-93fa-1aef7e2ad44d' 
AND "parentId" IS NOT NULL;
