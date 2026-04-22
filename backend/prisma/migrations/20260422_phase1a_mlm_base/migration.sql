-- ============================================================
-- Migration: phase1a_mlm_base
-- Description: Phase 1A - Additive schema for MLM/Consultant base
--   - Enums: ConsultantTier, ConsultantStatus, ClientStatus
--   - New tables: ConsultantProfile, ClientProfile
--   - Additive optional columns on User (sponsorId, homeTenantId)
--   - Additive column on Tenant (tenantType, default 'personal')
--
-- SAFETY:
--   - All changes are additive; no existing column is modified.
--   - No routes or services consume these columns yet.
--   - Feature flags (consultant.enabled, mlm.enabled) remain OFF.
--   - Existing users/tenants keep working without any change.
--
-- Date: 2026-04-22
-- ============================================================

-- CreateEnum: ConsultantTier
CREATE TYPE "ConsultantTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND');

-- CreateEnum: ConsultantStatus
CREATE TYPE "ConsultantStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum: ClientStatus
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CHURNED');

-- AlterTable: User - additive nullable columns (no behavior change)
ALTER TABLE "User" ADD COLUMN "sponsorId" TEXT;
ALTER TABLE "User" ADD COLUMN "homeTenantId" TEXT;

-- AlterTable: Tenant - additive column with safe default
ALTER TABLE "Tenant" ADD COLUMN "tenantType" TEXT NOT NULL DEFAULT 'personal';

-- CreateTable: ConsultantProfile (1:1 with User)
CREATE TABLE "ConsultantProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ConsultantStatus" NOT NULL DEFAULT 'PENDING',
    "tier" "ConsultantTier" NOT NULL DEFAULT 'BRONZE',
    "displayName" TEXT,
    "bio" TEXT,
    "publicSlug" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ConsultantProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ClientProfile (1:1 with User for the client side)
CREATE TABLE "ClientProfile" (
    "id" TEXT NOT NULL,
    "clientUserId" TEXT NOT NULL,
    "consultantUserId" TEXT,
    "tenantId" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX "ConsultantProfile_userId_key" ON "ConsultantProfile"("userId");
CREATE UNIQUE INDEX "ConsultantProfile_publicSlug_key" ON "ConsultantProfile"("publicSlug");
CREATE UNIQUE INDEX "ClientProfile_clientUserId_key" ON "ClientProfile"("clientUserId");

-- Secondary indexes
CREATE INDEX "User_sponsorId_idx" ON "User"("sponsorId");
CREATE INDEX "User_homeTenantId_idx" ON "User"("homeTenantId");
CREATE INDEX "ConsultantProfile_status_idx" ON "ConsultantProfile"("status");
CREATE INDEX "ConsultantProfile_tier_idx" ON "ConsultantProfile"("tier");
CREATE INDEX "ClientProfile_consultantUserId_idx" ON "ClientProfile"("consultantUserId");
CREATE INDEX "ClientProfile_tenantId_idx" ON "ClientProfile"("tenantId");
CREATE INDEX "ClientProfile_status_idx" ON "ClientProfile"("status");

-- Foreign keys
ALTER TABLE "User" ADD CONSTRAINT "User_sponsorId_fkey"
    FOREIGN KEY ("sponsorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConsultantProfile" ADD CONSTRAINT "ConsultantProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_clientUserId_fkey"
    FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
