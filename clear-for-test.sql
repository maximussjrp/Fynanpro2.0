-- Deletar transações do tenant de teste (soft delete)
UPDATE "Transaction" 
SET "deletedAt" = NOW()
WHERE "tenantId" = 'f0226d49-7801-46b6-a7ad-84fa0a6ccc32'
  AND "deletedAt" IS NULL;

-- Verificar que foram deletadas
SELECT COUNT(*) as remaining 
FROM "Transaction"
WHERE "tenantId" = 'f0226d49-7801-46b6-a7ad-84fa0a6ccc32'
  AND "deletedAt" IS NULL;
