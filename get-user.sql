-- Get user with Nubank PJ account tenant
SELECT u."id", u."email", u."tenantId" 
FROM "User" u 
WHERE u."tenantId" = 'f0226d49-7801-46b6-a7ad-84fa0a6ccc32'
LIMIT 1;
