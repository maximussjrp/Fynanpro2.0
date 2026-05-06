#!/bin/bash
set -uo pipefail
T="eb21b270-170b-4c1e-83dc-2b4e49f22341"
PSQL='docker exec utop-postgres psql -U utop_user -d utop'

echo "=== Auxiliares (escopo tenant Max) ==="
$PSQL -c "SELECT 'budgets' AS t, count(*) FROM \"Budget\" WHERE \"tenantId\"='$T' UNION ALL SELECT 'category_semantics', count(*) FROM \"CategorySemantics\" WHERE \"tenantId\"='$T' UNION ALL SELECT 'trigger_categories', count(*) FROM \"TriggerCategory\" WHERE \"tenantId\"='$T' UNION ALL SELECT 'saved_filters', count(*) FROM \"SavedFilter\" WHERE \"tenantId\"='$T' UNION ALL SELECT 'imports', count(*) FROM \"Import\" WHERE \"tenantId\"='$T' UNION ALL SELECT 'notifications', count(*) FROM \"Notification\" WHERE \"tenantId\"='$T';"

echo ""
echo "=== Transações com parentId NOT NULL (children) ==="
$PSQL -c "SELECT count(*) FROM \"Transaction\" WHERE \"tenantId\"='$T' AND \"parentId\" IS NOT NULL;"

echo ""
echo "=== Categories com children (parentId NOT NULL) ==="
$PSQL -c "SELECT count(*) FROM \"Category\" WHERE \"tenantId\"='$T' AND \"parentId\" IS NOT NULL;"

echo ""
echo "=== UserProfile do Max ==="
$PSQL -c "SELECT id, name FROM \"UserProfile\" WHERE \"tenantId\"='$T';"

echo ""
echo "=== Sample categorias atuais (5 primeiras) ==="
$PSQL -c "SELECT id, name, type, \"parentId\" FROM \"Category\" WHERE \"tenantId\"='$T' ORDER BY \"createdAt\" LIMIT 5;"

echo ""
echo "=== Sample payment methods atuais ==="
$PSQL -c "SELECT id, name, type, \"bankAccountId\" FROM \"PaymentMethod\" WHERE \"tenantId\"='$T' ORDER BY \"createdAt\";"
