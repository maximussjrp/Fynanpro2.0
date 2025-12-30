SELECT id, description, "deletedAt", "createdAt"
FROM "Transaction" 
WHERE id = '6654229f-4496-4e54-995e-0928be849ee3';

-- Ver todas as filhas desta transação
SELECT id, description, status, "deletedAt", date
FROM "Transaction" 
WHERE "parentId" = '6654229f-4496-4e54-995e-0928be849ee3'
ORDER BY date;
