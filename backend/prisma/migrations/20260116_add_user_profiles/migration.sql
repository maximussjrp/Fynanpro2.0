-- ============================================================
-- Migration: add_user_profiles
-- Description: Adiciona sistema de perfis para monitoramento fiscal por CPF
-- Date: 2026-01-16
-- ============================================================

-- CreateTable: UserProfile - Perfis dentro de um tenant (ex: marido, esposa)
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "documentType" TEXT NOT NULL DEFAULT 'PF',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "avatar" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BankAccountOwner - Vincula conta bancária a perfis/titulares
CREATE TABLE "BankAccountOwner" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "ownershipPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "isPrimaryOwner" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccountOwner_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Transaction - Adiciona vínculo com perfil
ALTER TABLE "Transaction" ADD COLUMN "userProfileId" TEXT;

-- CreateIndex: UserProfile indexes
CREATE INDEX "UserProfile_tenantId_isActive_idx" ON "UserProfile"("tenantId", "isActive");
CREATE INDEX "UserProfile_tenantId_document_idx" ON "UserProfile"("tenantId", "document");
CREATE INDEX "UserProfile_tenantId_isDefault_idx" ON "UserProfile"("tenantId", "isDefault");

-- CreateIndex: BankAccountOwner indexes
CREATE UNIQUE INDEX "BankAccountOwner_bankAccountId_userProfileId_key" ON "BankAccountOwner"("bankAccountId", "userProfileId");
CREATE INDEX "BankAccountOwner_bankAccountId_idx" ON "BankAccountOwner"("bankAccountId");
CREATE INDEX "BankAccountOwner_userProfileId_idx" ON "BankAccountOwner"("userProfileId");

-- CreateIndex: Transaction index for userProfileId
CREATE INDEX "Transaction_userProfileId_idx" ON "Transaction"("userProfileId");

-- AddForeignKey: UserProfile -> Tenant
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BankAccountOwner -> BankAccount
ALTER TABLE "BankAccountOwner" ADD CONSTRAINT "BankAccountOwner_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BankAccountOwner -> UserProfile
ALTER TABLE "BankAccountOwner" ADD CONSTRAINT "BankAccountOwner_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Transaction -> UserProfile
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
