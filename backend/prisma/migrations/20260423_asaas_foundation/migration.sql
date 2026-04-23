-- ============================================================
-- Migration: asaas_foundation (Fase A1)
-- Description: Fundação da integração Asaas — tabelas aditivas
--   - BillingCustomer      : mapping tenant → asaasCustomerId (histórico suportado)
--   - AsaasWebhookEvent    : log append-only de webhooks (dedup + auditoria)
--   - DomainEvent          : outbox de eventos de domínio (retry + DLQ)
--
-- SAFETY:
--   - 100% aditivo: nenhuma tabela/coluna existente é tocada.
--   - Nenhum código de runtime consome essas tabelas ainda (flags OFF).
--   - Stripe (legado congelado) intocado.
--
-- Data: 2026-04-23
-- ============================================================

-- CreateTable: BillingCustomer (histórico por tenant)
CREATE TABLE "BillingCustomer" (
    "id"                TEXT         NOT NULL,
    "tenantId"          TEXT         NOT NULL,
    "provider"          TEXT         NOT NULL DEFAULT 'asaas',
    "asaasCustomerId"   TEXT         NOT NULL,
    "isActive"          BOOLEAN      NOT NULL DEFAULT true,
    "metadata"          JSONB,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,
    "deletedAt"         TIMESTAMP(3),

    CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id")
);

-- Unicidade: mesmo asaasCustomerId não pode aparecer duas vezes ativo.
CREATE UNIQUE INDEX "BillingCustomer_provider_asaasCustomerId_key"
    ON "BillingCustomer"("provider", "asaasCustomerId");

-- Busca por tenant (mais comum: "qual é o customer ativo deste tenant?").
CREATE INDEX "BillingCustomer_tenantId_isActive_idx"
    ON "BillingCustomer"("tenantId", "isActive");

CREATE INDEX "BillingCustomer_tenantId_createdAt_idx"
    ON "BillingCustomer"("tenantId", "createdAt");

-- FK para Tenant (preservação referencial; CASCADE acompanha delete lógico/físico do tenant).
ALTER TABLE "BillingCustomer" ADD CONSTRAINT "BillingCustomer_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- CreateTable: AsaasWebhookEvent (append-only, dedup por eventId)
-- ============================================================
CREATE TABLE "AsaasWebhookEvent" (
    "id"             TEXT         NOT NULL,
    "asaasEventId"   TEXT,                      -- id do evento vindo do Asaas (pode ser null em payloads antigos)
    "eventType"      TEXT         NOT NULL,     -- ex: PAYMENT_CONFIRMED, SUBSCRIPTION_CREATED
    "payload"        JSONB        NOT NULL,     -- payload bruto original, para replay/auditoria
    "receivedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt"    TIMESTAMP(3),              -- quando terminou de processar (nullable se ainda só persistido)
    "status"         TEXT         NOT NULL DEFAULT 'received', -- received | processed | failed
    "lastError"      TEXT,
    "signatureValid" BOOLEAN      NOT NULL DEFAULT false,

    CONSTRAINT "AsaasWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- Dedup: um evento do Asaas só entra uma vez. Índice unique simples (Postgres trata múltiplos NULL como distintos — `@unique` no schema.prisma).
CREATE UNIQUE INDEX "AsaasWebhookEvent_asaasEventId_key"
    ON "AsaasWebhookEvent"("asaasEventId");

CREATE INDEX "AsaasWebhookEvent_eventType_idx"     ON "AsaasWebhookEvent"("eventType");
CREATE INDEX "AsaasWebhookEvent_status_idx"        ON "AsaasWebhookEvent"("status");
CREATE INDEX "AsaasWebhookEvent_receivedAt_idx"    ON "AsaasWebhookEvent"("receivedAt");

-- ============================================================
-- CreateTable: DomainEvent (outbox pattern com retry/DLQ)
-- ============================================================
CREATE TABLE "DomainEvent" (
    "id"            TEXT         NOT NULL,
    "eventType"     TEXT         NOT NULL,     -- ex: billing.customer.created, subscription.activated
    "aggregateType" TEXT,                      -- ex: Tenant, Subscription, BillingCustomer
    "aggregateId"   TEXT,
    "payload"       JSONB        NOT NULL,
    "status"        TEXT         NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed | dead
    "attempts"      INTEGER      NOT NULL DEFAULT 0,
    "lastError"     TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    "processedAt"   TIMESTAMP(3),

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DomainEvent_status_nextAttemptAt_idx" ON "DomainEvent"("status", "nextAttemptAt");
CREATE INDEX "DomainEvent_eventType_idx"            ON "DomainEvent"("eventType");
CREATE INDEX "DomainEvent_aggregateType_aggregateId_idx"
    ON "DomainEvent"("aggregateType", "aggregateId");
CREATE INDEX "DomainEvent_createdAt_idx"            ON "DomainEvent"("createdAt");
