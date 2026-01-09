-- Ver colunas da tabela User
SELECT column_name FROM information_schema.columns WHERE table_name = 'User';

-- Ver colunas da tabela Transaction
SELECT column_name FROM information_schema.columns WHERE table_name = 'Transaction';

-- Todas as transações com despesas atrasadas
SELECT t.id, t.description, t.amount, t.status, t."dueDate"
FROM "Transaction" t
WHERE t.status = 'pending' AND t."dueDate" < CURRENT_DATE AND t.type = 'expense'
ORDER BY t."dueDate" DESC
LIMIT 20;

-- Total de transações no sistema
SELECT count(*) as total_transacoes FROM "Transaction";

-- Total por status
SELECT status, count(*) FROM "Transaction" GROUP BY status;
