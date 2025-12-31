-- Verificar recorrências recentes e seus status
SELECT 
  id, 
  description, 
  status, 
  frequency,
  "parentId",
  "transactionDate",
  "createdAt"
FROM "Transaction" 
WHERE "tenantId" = '4c8ff719-5b7a-4b69-93fa-1aef7e2ad44d' 
  AND frequency IS NOT NULL 
ORDER BY "createdAt" DESC 
LIMIT 10;
