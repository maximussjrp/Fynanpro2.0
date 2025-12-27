-- 1. Quantos tenants existem?
SELECT COUNT(*) as total_tenants FROM "Tenant" WHERE "deletedAt" IS NULL;

-- 2. Verificar transações vinculadas a categorias
SELECT COUNT(*) as transacoes_com_categoria FROM "Transaction" WHERE "categoryId" IS NOT NULL;

-- 3. Listar os tenants
SELECT id, name FROM "Tenant" WHERE "deletedAt" IS NULL;
