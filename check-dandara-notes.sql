SELECT 
  id, 
  LEFT(description, 30) as desc, 
  status,
  "transactionType",
  "parentId",
  notes
FROM "Transaction" 
WHERE description LIKE '%DANDARA%' 
ORDER BY "transactionDate" DESC;
