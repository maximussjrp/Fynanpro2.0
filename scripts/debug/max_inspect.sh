#!/bin/bash
set -uo pipefail
PSQL='docker exec utop-postgres psql -U utop_user -d utop'

echo "=== USER ==="
$PSQL -c "SELECT id, email, \"fullName\", \"homeTenantId\" FROM \"User\" WHERE email='max.guarinieri@gmail.com';"

echo "=== TENANTS owned by Max ==="
$PSQL -c "SELECT t.id, t.name, t.slug, t.\"tenantType\", t.\"subscriptionPlan\" FROM \"Tenant\" t JOIN \"User\" u ON t.\"ownerId\"=u.id WHERE u.email='max.guarinieri@gmail.com';"

echo "=== TenantUser memberships of Max ==="
$PSQL -c "SELECT tu.\"tenantId\", t.name, tu.role FROM \"TenantUser\" tu JOIN \"Tenant\" t ON tu.\"tenantId\"=t.id JOIN \"User\" u ON tu.\"userId\"=u.id WHERE u.email='max.guarinieri@gmail.com';"

echo "=== BankAccounts atuais (todos os tenants do Max) ==="
$PSQL -c "SELECT ba.id, ba.\"tenantId\", ba.name, ba.type, ba.institution, ba.\"currentBalance\", ba.\"isActive\", ba.\"deletedAt\" FROM \"BankAccount\" ba JOIN \"Tenant\" t ON ba.\"tenantId\"=t.id JOIN \"User\" u ON t.\"ownerId\"=u.id WHERE u.email='max.guarinieri@gmail.com' ORDER BY ba.\"createdAt\";"

echo "=== Counts atuais (escopo Max) ==="
$PSQL -c "WITH max_tenants AS (SELECT t.id FROM \"Tenant\" t JOIN \"User\" u ON t.\"ownerId\"=u.id WHERE u.email='max.guarinieri@gmail.com') SELECT 'transactions' AS t, count(*) FROM \"Transaction\" WHERE \"tenantId\" IN (SELECT id FROM max_tenants) UNION ALL SELECT 'recurring_bills', count(*) FROM \"RecurringBill\" WHERE \"tenantId\" IN (SELECT id FROM max_tenants) UNION ALL SELECT 'recurring_occurrences', count(*) FROM \"RecurringBillOccurrence\" WHERE \"tenantId\" IN (SELECT id FROM max_tenants) UNION ALL SELECT 'installment_purchases', count(*) FROM \"InstallmentPurchase\" WHERE \"tenantId\" IN (SELECT id FROM max_tenants) UNION ALL SELECT 'installments', count(*) FROM \"Installment\" WHERE \"tenantId\" IN (SELECT id FROM max_tenants) UNION ALL SELECT 'payment_methods', count(*) FROM \"PaymentMethod\" WHERE \"tenantId\" IN (SELECT id FROM max_tenants) UNION ALL SELECT 'categories', count(*) FROM \"Category\" WHERE \"tenantId\" IN (SELECT id FROM max_tenants) UNION ALL SELECT 'bank_accounts', count(*) FROM \"BankAccount\" WHERE \"tenantId\" IN (SELECT id FROM max_tenants);"
