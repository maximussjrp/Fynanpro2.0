SELECT name, type, level, "parentId" IS NOT NULL as has_parent
FROM "Category" 
WHERE "deletedAt" IS NULL 
ORDER BY level, name 
LIMIT 80;
