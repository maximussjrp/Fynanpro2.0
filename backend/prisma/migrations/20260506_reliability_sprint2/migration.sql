-- UTOP Reliability Sprint 2 — proteções de integridade
-- Data: 2026-05-06
--
-- 1. Idempotência do chatbot:
--    Mesma (sourceSessionId, sourceMessageId) NÃO pode gerar duas
--    transações. Partial unique para não conflitar com:
--      - transações criadas fora do chatbot (source != 'chatbot' / NULL)
--      - sourceMessageId NULL (alguns flows legados)
--      - registros soft-deleted
--
-- 2. Idempotência de ocorrência recorrente:
--    Mesma (recurringBillId, dueDate) NÃO pode gerar duas ocorrências.
--    Partial para ignorar soft-deleted.
--
-- ATENÇÃO: Em prod, se já existirem duplicatas, esta migration FALHA.
-- O processo é: rodar SELECT abaixo manualmente, limpar duplicatas,
-- então rodar `prisma migrate deploy`.
--
--   -- Diagnóstico de duplicatas chatbot:
--   SELECT "tenantId","sourceSessionId","sourceMessageId", COUNT(*)
--   FROM "Transaction"
--   WHERE source='chatbot' AND "sourceMessageId" IS NOT NULL AND "deletedAt" IS NULL
--   GROUP BY 1,2,3 HAVING COUNT(*) > 1;
--
--   -- Diagnóstico de duplicatas de ocorrência:
--   SELECT "recurringBillId","dueDate", COUNT(*)
--   FROM "RecurringBillOccurrence"
--   WHERE "deletedAt" IS NULL
--   GROUP BY 1,2 HAVING COUNT(*) > 1;

-- ============================================================
-- 1) Chatbot idempotency (Transaction)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_chatbot_idempotency_uniq"
  ON "Transaction" ("tenantId", "sourceSessionId", "sourceMessageId")
  WHERE source = 'chatbot'
    AND "sourceMessageId" IS NOT NULL
    AND "deletedAt" IS NULL;

-- ============================================================
-- 2) Ocorrência recorrente idempotente (RecurringBillOccurrence)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS "RecurringBillOccurrence_bill_dueDate_uniq"
  ON "RecurringBillOccurrence" ("recurringBillId", "dueDate")
  WHERE "deletedAt" IS NULL;
