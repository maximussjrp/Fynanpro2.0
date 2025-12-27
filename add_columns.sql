-- Adicionar campos de verificação de email e reset de senha no User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMP;

-- Adicionar campos do Stripe no Tenant
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "stripeCurrentPeriodEnd" TIMESTAMP;

-- Criar índices para os campos do Stripe
CREATE INDEX IF NOT EXISTS "Tenant_stripeCustomerId_idx" ON "Tenant" ("stripeCustomerId");
CREATE INDEX IF NOT EXISTS "Tenant_stripeSubscriptionId_idx" ON "Tenant" ("stripeSubscriptionId");
