-- ============================================================
-- Fase A2A — SaaS Subscription Core
--
-- 100% aditivo, zero alterações destrutivas.
-- Novos enums:    BillingProvider, SubscriptionStatus, PaymentStatus, PaymentOwnerType
-- Novas tabelas:  Subscription, PaymentRecord
--
-- Nenhum código de runtime consome estas tabelas ainda.
-- Será ativado em C2–C5 com feature flags (default OFF).
-- ============================================================

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('asaas', 'stripe');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('pending', 'active', 'past_due', 'suspended', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded', 'chargeback');

-- CreateEnum
CREATE TYPE "PaymentOwnerType" AS ENUM ('tenant', 'user');

-- CreateTable: Subscription (projeção local; Asaas é source of truth)
CREATE TABLE "Subscription" (
    "id"                   TEXT NOT NULL,
    "tenantId"             TEXT NOT NULL,
    "provider"             "BillingProvider" NOT NULL DEFAULT 'asaas',
    "asaasSubscriptionId"  TEXT,
    "stripeSubscriptionId" TEXT,
    "plan"                 TEXT NOT NULL,
    "status"               "SubscriptionStatus" NOT NULL DEFAULT 'pending',
    "cycle"                TEXT NOT NULL DEFAULT 'MONTHLY',
    "amountCents"          INTEGER NOT NULL,
    "currency"             TEXT NOT NULL DEFAULT 'BRL',
    "startedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodStart"   TIMESTAMP(3),
    "currentPeriodEnd"     TIMESTAMP(3),
    "cancelledAt"          TIMESTAMP(3),
    "metadata"             JSONB,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- Unique composto provider+asaasSubscriptionId (NULL-tolerante, Postgres trata NULLs como distintos).
CREATE UNIQUE INDEX "Subscription_provider_asaasSubscriptionId_key"
    ON "Subscription"("provider", "asaasSubscriptionId");

CREATE INDEX "Subscription_tenantId_status_idx"
    ON "Subscription"("tenantId", "status");

CREATE INDEX "Subscription_tenantId_createdAt_idx"
    ON "Subscription"("tenantId", "createdAt");

CREATE INDEX "Subscription_status_currentPeriodEnd_idx"
    ON "Subscription"("status", "currentPeriodEnd");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateTable: PaymentRecord (cobrança individual, polimórfica)
CREATE TABLE "PaymentRecord" (
    "id"              TEXT NOT NULL,
    "provider"        "BillingProvider" NOT NULL DEFAULT 'asaas',
    "asaasPaymentId"  TEXT,
    "stripeInvoiceId" TEXT,
    "subscriptionId"  TEXT,
    "ownerType"       "PaymentOwnerType" NOT NULL,
    "ownerTenantId"   TEXT,
    "ownerUserId"     TEXT,
    "amountCents"     INTEGER NOT NULL,
    "currency"        TEXT NOT NULL DEFAULT 'BRL',
    "status"          "PaymentStatus" NOT NULL DEFAULT 'pending',
    "paymentMethod"   TEXT,
    "dueDate"         TIMESTAMP(3),
    "paidAt"          TIMESTAMP(3),
    "failedAt"        TIMESTAMP(3),
    "refundedAt"      TIMESTAMP(3),
    "rawPayload"      JSONB,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- Idempotência: um pagamento do Asaas só entra uma vez.
CREATE UNIQUE INDEX "PaymentRecord_asaasPaymentId_key"
    ON "PaymentRecord"("asaasPaymentId");

-- Idempotência legada Stripe (caso venha a ser usada em backfill futuro).
CREATE UNIQUE INDEX "PaymentRecord_stripeInvoiceId_key"
    ON "PaymentRecord"("stripeInvoiceId");

CREATE INDEX "PaymentRecord_ownerType_ownerTenantId_idx"
    ON "PaymentRecord"("ownerType", "ownerTenantId");

CREATE INDEX "PaymentRecord_ownerType_ownerUserId_idx"
    ON "PaymentRecord"("ownerType", "ownerUserId");

CREATE INDEX "PaymentRecord_subscriptionId_idx"
    ON "PaymentRecord"("subscriptionId");

CREATE INDEX "PaymentRecord_status_dueDate_idx"
    ON "PaymentRecord"("status", "dueDate");

-- FKs: SetNull preserva histórico do pagamento se a subscription/tenant for removida
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_ownerTenantId_fkey"
    FOREIGN KEY ("ownerTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
