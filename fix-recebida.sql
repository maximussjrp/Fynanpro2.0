-- Corrigir transações que contêm 'recebida' ou 'recebido' mas estão como expense
UPDATE "Transaction" 
SET type = 'income' 
WHERE (LOWER(description) LIKE '%recebida%' OR LOWER(description) LIKE '%recebido%')
AND type = 'expense';

-- Mostrar resultado
SELECT description, type, amount FROM "Transaction" 
WHERE LOWER(description) LIKE '%recebida%' OR LOWER(description) LIKE '%recebido%'
LIMIT 10;
