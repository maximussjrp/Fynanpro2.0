SELECT c.name, c.level, p.name as parent_name
FROM "Category" c
LEFT JOIN "Category" p ON c."parentId" = p.id
WHERE c."deletedAt" IS NULL 
  AND c.name IN ('Manutenção', 'IPVA', 'Combustível', 'Documentação', 'Seguro', 'Outros', 'Roupas', 'Presentes', 'iFood')
  AND c."tenantId" = 'f0226d49-7801-46b6-a7ad-84fa0a6ccc32'
ORDER BY c.name, c.level;
