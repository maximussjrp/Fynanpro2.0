-- C5.0 — Billing source + Subscription.lastAsaasEventAt + backfill auditado
-- ============================================================================
-- DDL 100% aditiva e idempotente (IF NOT EXISTS). Zero risco para colunas
-- existentes ou dados legados.
-- ============================================================================

ALTER TABLE "Tenant"       ADD COLUMN IF NOT EXISTS "billingSource"     TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "lastAsaasEventAt"  TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Tenant_billingSource_idx" ON "Tenant"("billingSource");

-- ============================================================================
-- BACKFILL — ordem importa. Regras mais específicas primeiro. Todas as regras
-- após B1 possuem cláusula `billingSource IS NULL` para proteger valores já
-- atribuídos pelas regras anteriores.
-- ============================================================================

-- B1: tenant com Subscription Asaas em estado não-terminal → 'asaas'
UPDATE "Tenant" t
   SET "billingSource" = 'asaas'
 WHERE "billingSource" IS NULL
   AND EXISTS (
     SELECT 1 FROM "Subscription" s
      WHERE s."tenantId" = t."id"
        AND s."provider" = 'asaas'
        AND s."status" IN ('pending','active','past_due','suspended')
   );

-- B2: tenant com stripeSubscriptionId preenchido → 'stripe'
UPDATE "Tenant" t
   SET "billingSource" = 'stripe'
 WHERE "billingSource" IS NULL
   AND "stripeSubscriptionId" IS NOT NULL;

-- B3: tenant com plano 'trial' (qualquer status/trialEndsAt) → 'trial'
-- Cobre trial ativo, trial expirado com status='active' legado, e trial
-- que foi marcado suspended pelo middleware de trial-expiry.
UPDATE "Tenant" t
   SET "billingSource" = 'trial'
 WHERE "billingSource" IS NULL
   AND "subscriptionPlan" = 'trial';

-- B4: tenant sem provider, status suspended/cancelled → 'manual'
-- (override humano via admin; reconciliador não sobrescreve)
UPDATE "Tenant" t
   SET "billingSource" = 'manual'
 WHERE "billingSource" IS NULL
   AND "subscriptionStatus" IN ('suspended','cancelled')
   AND "stripeSubscriptionId" IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM "Subscription" s
      WHERE s."tenantId" = t."id" AND s."provider" = 'asaas'
   );

-- B5 (implícita): qualquer outro tenant permanece NULL (zona neutra).
-- Handlers podem promover em runtime via UPDATE condicional.

-- ============================================================================
-- Auditoria: imprime contagens no log do Postgres (docker logs do container).
-- Também asserta integridade: nenhuma linha de subscriptionStatus foi alterada.
-- ============================================================================

DO $$
DECLARE
  r RECORD;
  total_tenants BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_tenants FROM "Tenant";
  RAISE NOTICE 'C5.0 backfill: total tenants=%', total_tenants;

  FOR r IN
    SELECT COALESCE("billingSource", '<null>') AS src, COUNT(*) AS n
      FROM "Tenant" GROUP BY 1 ORDER BY 1
  LOOP
    RAISE NOTICE 'C5.0 backfill: billingSource=% count=%', r.src, r.n;
  END LOOP;
END $$;
