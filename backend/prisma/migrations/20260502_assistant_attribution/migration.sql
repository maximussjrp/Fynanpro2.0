-- ============================================================
-- Sprint 1 — Base de confiança do assistente (Isis)
--
-- 100% aditivo. Backward compatible.
-- Nenhuma coluna existente é alterada.
-- Nenhuma linha é tocada.
-- Sem FK hard: Transaction/BankAccount não devem ser invalidados
-- se a ChatSession/ChatMessage for apagada no futuro. A referência
-- é de auditoria, não funcional.
--
-- Adiciona rastreabilidade de ações originadas pelo assistente em:
--   - Transaction
--   - BankAccount
--
-- Campos:
--   source              -- 'manual' | 'chatbot' | 'import' | 'recurring' | 'api' | ...
--   createdByAssistant  -- BOOLEAN, default false
--   sourceSessionId     -- ChatSession.id (opcional)
--   sourceMessageId     -- ChatMessage.id  (opcional — user message que originou)
--   assistantRunId      -- agrupa efeitos colaterais de um mesmo processMessage()
-- ============================================================

-- Transaction
ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "source"             TEXT,
  ADD COLUMN IF NOT EXISTS "createdByAssistant" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sourceSessionId"    TEXT,
  ADD COLUMN IF NOT EXISTS "sourceMessageId"    TEXT,
  ADD COLUMN IF NOT EXISTS "assistantRunId"     TEXT;

CREATE INDEX IF NOT EXISTS "Transaction_source_idx"
  ON "Transaction"("source");

CREATE INDEX IF NOT EXISTS "Transaction_createdByAssistant_idx"
  ON "Transaction"("tenantId", "createdByAssistant");

CREATE INDEX IF NOT EXISTS "Transaction_sourceSessionId_idx"
  ON "Transaction"("sourceSessionId");

CREATE INDEX IF NOT EXISTS "Transaction_assistantRunId_idx"
  ON "Transaction"("assistantRunId");


-- BankAccount
ALTER TABLE "BankAccount"
  ADD COLUMN IF NOT EXISTS "source"             TEXT,
  ADD COLUMN IF NOT EXISTS "createdByAssistant" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sourceSessionId"    TEXT,
  ADD COLUMN IF NOT EXISTS "sourceMessageId"    TEXT,
  ADD COLUMN IF NOT EXISTS "assistantRunId"     TEXT;

CREATE INDEX IF NOT EXISTS "BankAccount_createdByAssistant_idx"
  ON "BankAccount"("tenantId", "createdByAssistant");

CREATE INDEX IF NOT EXISTS "BankAccount_sourceSessionId_idx"
  ON "BankAccount"("sourceSessionId");
