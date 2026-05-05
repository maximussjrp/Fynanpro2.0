-- UTOP Partners — Fase 0 — Pós-migration
--
-- Rodar SEPARADO da migration principal, FORA de transação.
-- CREATE INDEX CONCURRENTLY não pode rodar dentro de BEGIN/COMMIT.
-- Em produção, rodar via: psql -v ON_ERROR_STOP=1 -f postmigration.sql
--
-- Idempotente: usa IF NOT EXISTS.

-- =====================================================================
-- ÍNDICES PARCIAIS / DE COBERTURA (CONCURRENTLY)
-- =====================================================================

-- Aceleração do job hold-release (varre potencialmente milhões de linhas).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_partner_commission_hold_release"
  ON "partner_commissions" ("holdUntil")
  WHERE "status" = 'em_hold';

-- Aceleração do batch-generator (lista comissões aprovadas elegíveis).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_partner_commission_batch_eligible"
  ON "partner_commissions" ("beneficiaryConsultantId")
  WHERE "status" = 'aprovada';

-- Saldo do consultor: SUM(deltaCents) por consultantId.
-- INCLUDE evita ida ao heap em queries de saldo.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_partner_wallet_balance"
  ON "partner_wallet_entries" ("consultantId") INCLUDE ("deltaCents");

-- =====================================================================
-- SEED MÍNIMO — Curso da Fase 1
-- =====================================================================
-- Idempotente. Curso fixo "Formação Consultor Parceiro UTOP" a R$ 700.
INSERT INTO "partner_courses" ("id", "name", "priceCents", "active", "createdAt", "updatedAt")
VALUES (
  'crs_partner_v1',
  'Formação Consultor Parceiro UTOP',
  70000,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;
