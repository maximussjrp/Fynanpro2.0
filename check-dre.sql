-- Verificar tipos de categoria
SELECT DISTINCT type FROM "Category" LIMIT 10;

-- Ver algumas categorias com transações
SELECT c.name, c.type, c.level, c."parentId", COUNT(t.id) as tx_count
FROM "Category" c
LEFT JOIN "Transaction" t ON t."categoryId" = c.id
GROUP BY c.id, c.name, c.type, c.level, c."parentId"
HAVING COUNT(t.id) > 0
LIMIT 10;
