#!/bin/bash
set -euo pipefail
PSQL="docker exec utop-postgres psql -U utop_user -d utop -t -A"

echo "=== 1. Tables (expect 15) ==="
$PSQL -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'partner_%';"
$PSQL -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'partner_%' ORDER BY tablename;"

echo ""
echo "=== 2. Enums (expect 13) ==="
$PSQL -c "SELECT count(DISTINCT t.typname) FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname LIKE 'partner_%' OR t.typname IN ('PartnerKycStatus','CommissionStatus','CommissionType','PayoutStatus','EnrollmentStatus','BatchStatus','BatchItemStatus','WalletEntryType','AttributionStatus','BanReason','KycDocType','SponsorshipEdgeStatus','LinkStatus');"
$PSQL -c "SELECT DISTINCT t.typname FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid ORDER BY t.typname;" | grep -v -E '^(AsaasMode|GenderType|PaymentMethodType|RecurringBillStatus|TenantStatus|TransactionStatus|TransactionType|UserRole|RecurrenceType|InstallmentStatus|SubscriptionStatus|InvoiceStatus|MlmRoleType|StatusBoletoEnum|GoalType|SmartGoalCategory|SmartGoalStatus|SmartCheckStatus|SmartCheckType|TenantType|PaymentMethodCategory|AccountType|UserStatus|PixType|GoalStatus|MaintenanceMessageType|GoalProgressStatus|TenantPlan|SubscriptionPlan|BillingFrequency|GenderTypeEnum|StripeCustomerStatus|StripeSubscriptionStatus|StripeInvoiceStatus|StripeChargeStatus|StripeRefundStatus|StripeWebhookEventStatus|TransactionScheduleStatus|RecurrentTransactionStatus|InstallmentTransactionStatus|UserPlanType|RecurrenceFrequency|MaintenanceStatus|UserAccountType|UserAccountStatus|UserActiveStatus|UserVisitStatus|TenantPlanStatus|MaintenanceLogType)$' || true

echo ""
echo "=== 3. partner_* indexes idx_partner_% (expect 3) ==="
$PSQL -c "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_partner_%';"
$PSQL -c "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_partner_%' ORDER BY indexname;"

echo ""
echo "=== 4. FKs on partner_* (expect 19) ==="
$PSQL -c "SELECT count(*) FROM pg_constraint c JOIN pg_class t ON c.conrelid=t.oid WHERE c.contype='f' AND t.relname LIKE 'partner_%';"

echo ""
echo "=== 5. Seed course ==="
$PSQL -c "SELECT id, name, \"priceCents\", \"isActive\" FROM partner_courses;"

echo ""
echo "=== 6. _prisma_migrations entry ==="
$PSQL -c "SELECT migration_name, applied_steps_count, rolled_back_at FROM _prisma_migrations WHERE migration_name='20260425_partners_phase0_foundation';"

echo ""
echo "=== 7. Backend health ==="
docker exec utop-backend node -e "require('http').get('http://localhost:3001/health',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log(r.statusCode,d))}).on('error',e=>console.log('ERR',e.message))" 2>&1 || true

echo ""
echo "=== 8. Backend logs (last 30, ERROR/Error grep) ==="
docker logs utop-backend --tail 50 2>&1 | grep -iE 'error|fatal|partner' | head -20 || echo "(no error/partner lines)"

echo ""
echo "=== 9. /api/partners/* not exposed (expect 404) ==="
docker exec utop-backend node -e "require('http').get('http://localhost:3001/api/partners/me',r=>console.log('status=',r.statusCode)).on('error',e=>console.log('ERR',e.message))" 2>&1 || true
