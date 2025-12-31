-- Verificar o template PAI
SELECT 
  id, 
  description, 
  status, 
  frequency,
  "parentId",
  "transactionDate",
  "createdAt"
FROM "Transaction" 
WHERE id = '51ad501f-d9a3-47c0-b05b-26d850ff41c0';
