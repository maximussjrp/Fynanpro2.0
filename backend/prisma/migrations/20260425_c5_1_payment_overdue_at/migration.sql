-- C5.1 — Auditabilidade do estado OVERDUE
--
-- Como o enum PaymentStatus não possui um valor "overdue" (é intencional:
-- o estado padrão do Asaas para pagamento vencido e ainda não pago é
-- "pendente com dueDate no passado"), introduzimos um carimbo temporal
-- explícito para tornar a detecção de atraso rastreável.
--
-- Regras:
--   - Aditiva (IF NOT EXISTS), idempotente.
--   - Nullable sem default.
--   - Backfill: NONE — pagamentos históricos ficam NULL (desconhecemos o
--     momento em que foram considerados vencidos no passado).
--
-- Preenchimento:
--   - Handler PAYMENT_OVERDUE seta overdueAt = NOW() na primeira vez que
--     o evento chega (preserva o timestamp em chamadas repetidas).

ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "overdueAt" TIMESTAMP(3);

-- Audit log (aparece no docker logs do backend durante prisma migrate deploy).
DO $$
DECLARE
  total INT;
  with_overdue INT;
BEGIN
  SELECT COUNT(*) INTO total FROM "PaymentRecord";
  SELECT COUNT(*) INTO with_overdue FROM "PaymentRecord" WHERE "overdueAt" IS NOT NULL;
  RAISE NOTICE 'C5.1 migration: PaymentRecord total=%, overdueAt preenchidos=% (esperado 0 no primeiro deploy)', total, with_overdue;
END $$;
