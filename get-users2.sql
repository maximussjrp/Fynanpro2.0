-- Get all users with their tenants
SELECT 
  u."id" as user_id,
  u."email",
  tu."tenantId"
FROM "User" u
JOIN "TenantUser" tu ON u."id" = tu."userId"
LIMIT 5;

-- Get bank accounts
SELECT "id", "name", "tenantId" FROM "BankAccount" WHERE name LIKE '%Nubank%' LIMIT 3;
