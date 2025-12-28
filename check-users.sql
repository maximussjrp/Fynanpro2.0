SELECT id, email, name, "tenantId", role, "createdAt" 
FROM "User" 
WHERE email LIKE '%max%' OR role = 'SUPER_ADMIN'
ORDER BY "createdAt" DESC
LIMIT 10;
