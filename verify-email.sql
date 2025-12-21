-- Verificar usuários
SELECT id, email, "fullName", "isActive", "isEmailVerified" FROM "User";

-- Ativar verificação de email para todos os super_masters
UPDATE "User" SET "isEmailVerified" = true, "isActive" = true WHERE role = 'super_master';

-- Verificar resultado
SELECT id, email, "fullName", "isActive", "isEmailVerified" FROM "User";
