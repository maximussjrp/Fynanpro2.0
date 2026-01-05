-- Verificar hierarquia de categorias

-- 1. Quantas categorias existem por nível
SELECT 
  level,
  COUNT(*) as total,
  COUNT(CASE WHEN "isActive" = true THEN 1 END) as ativas
FROM "Category"
WHERE "deletedAt" IS NULL
GROUP BY level
ORDER BY level;

-- 2. Categorias de nível 1 com contagem de filhos
SELECT 
  c.id,
  c.name,
  c.type,
  c.icon,
  c.level,
  COUNT(child.id) as filhos_diretos
FROM "Category" c
LEFT JOIN "Category" child ON child."parentId" = c.id AND child."deletedAt" IS NULL
WHERE c.level = 1 AND c."deletedAt" IS NULL AND c."isActive" = true
GROUP BY c.id, c.name, c.type, c.icon, c.level
ORDER BY c.type, c.name;

-- 3. Categorias órfãs (parentId aponta para categoria inexistente ou deletada)
SELECT 
  c.id,
  c.name,
  c.type,
  c.level,
  c."parentId"
FROM "Category" c
WHERE c."parentId" IS NOT NULL
  AND c."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Category" p 
    WHERE p.id = c."parentId" AND p."deletedAt" IS NULL
  );

-- 4. Estrutura hierárquica completa (Moradia como exemplo)
SELECT 
  CASE 
    WHEN c.level = 1 THEN c.name
    WHEN c.level = 2 THEN '  └── ' || c.name
    WHEN c.level = 3 THEN '      └── ' || c.name
  END as hierarquia,
  c.type,
  c.level,
  c.id
FROM "Category" c
WHERE c."deletedAt" IS NULL AND c."isActive" = true
ORDER BY 
  COALESCE((SELECT p.name FROM "Category" p WHERE p.id = c."parentId"), c.name),
  c.level,
  c.name;
