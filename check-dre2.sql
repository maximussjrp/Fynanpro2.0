-- Ver categorias level 1 
SELECT id, name, type, level, "parentId" FROM "Category" WHERE level = 1 LIMIT 20;

-- Verificar transações de 2025
SELECT COUNT(*), date_trunc('month', "transactionDate") as mes 
FROM "Transaction" 
WHERE EXTRACT(YEAR FROM "transactionDate") = 2025
GROUP BY mes 
ORDER BY mes;
