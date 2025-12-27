-- Verificar tipo das transações recebidas
SELECT description, type, amount FROM "Transaction" 
WHERE description ILIKE '%recebida%' 
LIMIT 10;
