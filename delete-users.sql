-- Lista usuários super_master (para manter)
SELECT id, email, role FROM "User" WHERE role = 'super_master';

-- Remove todos os usuários exceto super_master
-- Primeiro, limpa dependências

-- 1. Remove TenantUser de usuários não super_master
DELETE FROM "TenantUser" WHERE "userId" IN (SELECT id FROM "User" WHERE role != 'super_master');

-- 2. Remove RefreshToken de usuários não super_master  
DELETE FROM "RefreshToken" WHERE "userId" IN (SELECT id FROM "User" WHERE role != 'super_master');

-- 3. Remove Notification de usuários não super_master
DELETE FROM "Notification" WHERE "userId" IN (SELECT id FROM "User" WHERE role != 'super_master');

-- 4. Atualiza Tenant para remover ownerId de owners não super_master
UPDATE "Tenant" SET "ownerId" = NULL WHERE "ownerId" IN (SELECT id FROM "User" WHERE role != 'super_master');

-- 5. Agora deleta os usuários
DELETE FROM "User" WHERE role != 'super_master';

-- Confirma resultado
SELECT id, email, role FROM "User";
