-- Verificar colunas da tabela Transaction
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Transaction'
ORDER BY ordinal_position;

-- Verificar uma amostra de transações
SELECT 
  id,
  "transactionDate" as date,
  substring(description from 1 for 50) as desc_short,
  amount,
  type,
  "isTransfer",
  "linkedTransferId",
  "transactionKind",
  "importBatchId",
  "fitId",
  "excludedFromEnergy",
  "needsReview"
FROM "Transaction"
WHERE "tenantId" = 'f0226d49-7801-46b6-a7ad-84fa0a6ccc32'
  AND "deletedAt" IS NULL
ORDER BY "transactionDate" DESC
LIMIT 10;

-- Verificar transações que parecem transferências pelo nome
SELECT 
  id,
  "transactionDate" as date,
  substring(description from 1 for 80) as desc,
  amount,
  type,
  "isTransfer"
FROM "Transaction"
WHERE "tenantId" = 'f0226d49-7801-46b6-a7ad-84fa0a6ccc32'
  AND "deletedAt" IS NULL
  AND (description ILIKE '%transferência%' OR description ILIKE '%pix%')
ORDER BY "transactionDate" DESC
LIMIT 15;
