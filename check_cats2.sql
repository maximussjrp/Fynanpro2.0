-- Resumo por level
SELECT level, COUNT(*) as total
FROM "Category" 
WHERE "deletedAt" IS NULL 
GROUP BY level
ORDER BY level;

-- Categorias L1 com quantidade de filhos
SELECT c1.name as categoria_l1, c1.type, COUNT(c2.id) as filhos
FROM "Category" c1
LEFT JOIN "Category" c2 ON c2."parentId" = c1.id AND c2."deletedAt" IS NULL
WHERE c1."deletedAt" IS NULL AND c1.level = 1
GROUP BY c1.id, c1.name, c1.type
ORDER BY c1.name;
