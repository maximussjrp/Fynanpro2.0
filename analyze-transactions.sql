-- Contagem de transações por tipo
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE "isTransfer" = true) as transfers,
  COUNT(*) FILTER (WHERE "transactionKind" = 'invoice_payment') as invoice_payments,
  COUNT(*) FILTER (WHERE "transactionKind" = 'fee') as fees,
  COUNT(*) FILTER (WHERE "excludedFromEnergy" = true) as excluded_energy,
  COUNT(*) FILTER (WHERE "needsReview" = true) as needs_review
FROM "Transaction"
WHERE "tenantId" = 'f0226d49-7801-46b6-a7ad-84fa0a6ccc32'
  AND "deletedAt" IS NULL;

-- Amostras de transferências
SELECT 
  id,
  date,
  description,
  amount,
  "isTransfer",
  "linkedTransferId",
  "transactionKind"
FROM "Transaction"
WHERE "tenantId" = 'f0226d49-7801-46b6-a7ad-84fa0a6ccc32'
  AND "isTransfer" = true
  AND "deletedAt" IS NULL
LIMIT 10;

-- Amostras de pagamentos de fatura
SELECT 
  id,
  date,
  description,
  amount,
  "transactionKind"
FROM "Transaction"
WHERE "tenantId" = 'f0226d49-7801-46b6-a7ad-84fa0a6ccc32'
  AND "transactionKind" = 'invoice_payment'
  AND "deletedAt" IS NULL
LIMIT 5;

-- Verificar imports existentes
SELECT 
  id,
  "fileName",
  status,
  "totalRows",
  "createdCount",
  "dedupedCount",
  "transferPairs",
  "invoicePayments",
  "createdAt"
FROM "Import"
WHERE "tenantId" = 'f0226d49-7801-46b6-a7ad-84fa0a6ccc32'
ORDER BY "createdAt" DESC
LIMIT 5;
