-- Verificar transações importadas com campos da FASE 2.4
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE "isTransfer" = true) as transfers,
  COUNT(*) FILTER (WHERE "transactionKind" = 'invoice_payment') as invoice_payments,
  COUNT(*) FILTER (WHERE "transactionKind" = 'fee') as fees,
  COUNT(*) FILTER (WHERE "excludedFromEnergy" = true) as excluded_energy,
  COUNT(*) FILTER (WHERE "needsReview" = true) as needs_review,
  COUNT(*) FILTER (WHERE "linkedTransactionId" IS NOT NULL) as linked,
  COUNT(*) FILTER (WHERE "externalFitId" IS NOT NULL) as has_fitid,
  COUNT(*) FILTER (WHERE "importBatchId" IS NOT NULL) as has_batch
FROM "Transaction"
WHERE "tenantId" = 'f0226d49-7801-46b6-a7ad-84fa0a6ccc32'
  AND "deletedAt" IS NULL;

-- Amostras de transferências identificadas
SELECT 
  id,
  "transactionDate" as date,
  substring(description from 1 for 60) as desc,
  amount,
  type,
  "isTransfer",
  "linkedTransactionId"
FROM "Transaction"
WHERE "tenantId" = 'f0226d49-7801-46b6-a7ad-84fa0a6ccc32'
  AND "deletedAt" IS NULL
  AND "isTransfer" = true
LIMIT 10;

-- Pagamentos de fatura
SELECT 
  id,
  "transactionDate" as date,
  substring(description from 1 for 60) as desc,
  amount,
  "transactionKind"
FROM "Transaction"
WHERE "tenantId" = 'f0226d49-7801-46b6-a7ad-84fa0a6ccc32'
  AND "deletedAt" IS NULL
  AND "transactionKind" = 'invoice_payment';

-- Verificar Import record
SELECT 
  id,
  "fileName",
  status,
  "totalRows",
  "createdCount",
  "dedupedCount",
  "transferPairs",
  "invoicePayments",
  "needsReviewCount",
  "createdAt"
FROM "Import"
WHERE "tenantId" = 'f0226d49-7801-46b6-a7ad-84fa0a6ccc32'
ORDER BY "createdAt" DESC
LIMIT 5;
