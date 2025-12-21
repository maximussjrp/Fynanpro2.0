-- Script para remover todos os usuários exceto super_master
-- Ordem correta para respeitar foreign keys

BEGIN;

-- 1. Pegar IDs dos usuários que serão deletados (não super_master)
-- 2. Deletar todas as transações dos tenants desses usuários
DELETE FROM "Transaction" WHERE "tenantId" IN (
  SELECT t.id FROM "Tenant" t 
  JOIN "User" u ON t."ownerId" = u.id 
  WHERE u.role != 'super_master'
);

-- 3. Deletar categorias dos tenants
DELETE FROM "Category" WHERE "tenantId" IN (
  SELECT t.id FROM "Tenant" t 
  JOIN "User" u ON t."ownerId" = u.id 
  WHERE u.role != 'super_master'
);

-- 4. Deletar bank accounts dos tenants
DELETE FROM "BankAccount" WHERE "tenantId" IN (
  SELECT t.id FROM "Tenant" t 
  JOIN "User" u ON t."ownerId" = u.id 
  WHERE u.role != 'super_master'
);

-- 5. Deletar payment methods dos tenants
DELETE FROM "PaymentMethod" WHERE "tenantId" IN (
  SELECT t.id FROM "Tenant" t 
  JOIN "User" u ON t."ownerId" = u.id 
  WHERE u.role != 'super_master'
);

-- 6. Deletar budgets dos tenants
DELETE FROM "Budget" WHERE "tenantId" IN (
  SELECT t.id FROM "Tenant" t 
  JOIN "User" u ON t."ownerId" = u.id 
  WHERE u.role != 'super_master'
);

-- 7. Deletar TenantUser de usuários não super_master
DELETE FROM "TenantUser" WHERE "userId" IN (SELECT id FROM "User" WHERE role != 'super_master');

-- 8. Deletar TenantUser de tenants que serão removidos
DELETE FROM "TenantUser" WHERE "tenantId" IN (
  SELECT t.id FROM "Tenant" t 
  JOIN "User" u ON t."ownerId" = u.id 
  WHERE u.role != 'super_master'
);

-- 9. Deletar RefreshToken de usuários não super_master
DELETE FROM "RefreshToken" WHERE "userId" IN (SELECT id FROM "User" WHERE role != 'super_master');

-- 10. Deletar Notification de usuários não super_master
DELETE FROM "Notification" WHERE "userId" IN (SELECT id FROM "User" WHERE role != 'super_master');

-- 11. Deletar os Tenants dos usuários não super_master
DELETE FROM "Tenant" WHERE "ownerId" IN (SELECT id FROM "User" WHERE role != 'super_master');

-- 12. Deletar os usuários não super_master
DELETE FROM "User" WHERE role != 'super_master';

COMMIT;

-- Confirma resultado
SELECT id, email, role FROM "User";
SELECT COUNT(*) as remaining_tenants FROM "Tenant";
