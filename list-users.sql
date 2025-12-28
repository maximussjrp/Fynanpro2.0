SELECT id, email, "fullName", role, "isActive", "isEmailVerified", "lastLoginAt", "createdAt"
FROM "User" 
ORDER BY "createdAt" DESC
LIMIT 10;
