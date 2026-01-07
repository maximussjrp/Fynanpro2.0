SELECT id, LEFT(description, 30) as desc, "deletedAt", type 
FROM "Transaction" 
WHERE description LIKE '%DANDARA%' 
ORDER BY "transactionDate" DESC 
LIMIT 10;
