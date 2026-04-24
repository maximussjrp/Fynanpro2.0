-- C5.4 — Asaas reconciler: ReconciliationRun + ReconciliationFinding
--
-- Aditiva, idempotente. Zero alteração em tabelas existentes.
-- Nenhuma FF é ativada por esta migration; o job permanece OFF em prod.

DO $$ BEGIN
    CREATE TYPE "ReconciliationRunMode" AS ENUM ('shadow', 'dryrun', 'autofix');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReconciliationRunStatus" AS ENUM ('success', 'partial', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ReconciliationFindingKind" AS ENUM (
      'IN_SYNC',
      'LOCAL_ACTIVE_REMOTE_EXPIRED',
      'LOCAL_ACTIVE_REMOTE_INACTIVE',
      'LOCAL_ACTIVE_REMOTE_DELETED',
      'LOCAL_PAST_DUE_REMOTE_ACTIVE',
      'LOCAL_SUSPENDED_REMOTE_ACTIVE',
      'LOCAL_CANCELLED_REMOTE_ACTIVE',
      'REMOTE_NOT_FOUND',
      'LOCAL_NOT_FOUND',
      'PAYMENT_LAG',
      'UNKNOWN_REMOTE_STATUS'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "mode" "ReconciliationRunMode" NOT NULL,
    "status" "ReconciliationRunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "subscriptionsScanned" INTEGER NOT NULL DEFAULT 0,
    "findingsCount" INTEGER NOT NULL DEFAULT 0,
    "asaasApiCalls" INTEGER NOT NULL DEFAULT 0,
    "asaasRateLimitHits" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReconciliationRun_status_finishedAt_idx"
    ON "ReconciliationRun"("status", "finishedAt");
CREATE INDEX IF NOT EXISTS "ReconciliationRun_mode_startedAt_idx"
    ON "ReconciliationRun"("mode", "startedAt");

CREATE TABLE IF NOT EXISTS "ReconciliationFinding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "asaasSubscriptionId" TEXT,
    "kind" "ReconciliationFindingKind" NOT NULL,
    "localStatus" TEXT,
    "remoteStatus" TEXT,
    "remoteLastPaymentStatus" TEXT,
    "remoteLastPaymentDate" TIMESTAMP(3),
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationFinding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReconciliationFinding_tenantId_kind_createdAt_idx"
    ON "ReconciliationFinding"("tenantId", "kind", "createdAt");
CREATE INDEX IF NOT EXISTS "ReconciliationFinding_runId_kind_idx"
    ON "ReconciliationFinding"("runId", "kind");
CREATE INDEX IF NOT EXISTS "ReconciliationFinding_kind_createdAt_idx"
    ON "ReconciliationFinding"("kind", "createdAt");

-- FK separada para permitir re-execução idempotente (duplicate_object tolerado)
DO $$ BEGIN
    ALTER TABLE "ReconciliationFinding"
      ADD CONSTRAINT "ReconciliationFinding_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "ReconciliationRun"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
