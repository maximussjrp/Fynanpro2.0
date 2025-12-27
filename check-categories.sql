-- Verificar estrutura hierárquica das categorias
SELECT 
  id,
  name,
  type,
  level,
  "parentId"
FROM "Category" 
WHERE "deletedAt" IS NULL 
ORDER BY type, level, name 
LIMIT 30;

-- Verificar categorias com filhos
SELECT 
  p.name as parent_name,
  p.type,
  p.level as parent_level,
  COUNT(c.id) as child_count
FROM "Category" p
LEFT JOIN "Category" c ON c."parentId" = p.id AND c."deletedAt" IS NULL
WHERE p."deletedAt" IS NULL
GROUP BY p.id, p.name, p.type, p.level
HAVING COUNT(c.id) > 0
ORDER BY p.type, p.level;
