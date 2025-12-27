-- Verificar transações importadas por tipo
SELECT type, COUNT(*) as total, SUM(amount) as soma
FROM "Transaction"
WHERE notes LIKE '%Importado%'
GROUP BY type;

-- Ver algumas transações importadas
SELECT description, type, amount, notes
FROM "Transaction"
WHERE notes LIKE '%Importado%'
ORDER BY "transactionDate" DESC
LIMIT 20;
