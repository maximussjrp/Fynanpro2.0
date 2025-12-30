-- Buscar categoria de receita
SELECT id, name, type FROM "Category" 
WHERE "tenantId" = '4c8ff719-5b7a-4b69-93fa-1aef7e2ad44d' 
AND type = 'income' AND "isActive" = true
LIMIT 1;

-- Buscar conta bancária
SELECT id, name FROM "BankAccount" 
WHERE "tenantId" = '4c8ff719-5b7a-4b69-93fa-1aef7e2ad44d'
LIMIT 1;
