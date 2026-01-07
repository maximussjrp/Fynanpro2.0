SELECT 
  id, 
  LEFT(description, 40) as desc, 
  type,
  status,
  "deletedAt",
  "transactionType",
  "parentId"
FROM "Transaction" 
WHERE description LIKE '%DANDARA%' 
ORDER BY "transactionDate" DESC;
