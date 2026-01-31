#!/bin/bash

# Script para restaurar o backup

# Criar arquivo SQL de truncate
cat > /tmp/truncate.sql << 'EOSQL'
TRUNCATE "Transaction" CASCADE;
TRUNCATE "RecurringBillOccurrence" CASCADE;
TRUNCATE "RecurringBill" CASCADE;
TRUNCATE "PaymentMethod" CASCADE;
TRUNCATE "BankAccountOwner" CASCADE;
TRUNCATE "BankAccount" CASCADE;
TRUNCATE "Category" CASCADE;
TRUNCATE "CategorySemantics" CASCADE;
TRUNCATE "Budget" CASCADE;
TRUNCATE "UserProfile" CASCADE;
TRUNCATE "TenantUser" CASCADE;
TRUNCATE "Tenant" CASCADE;
TRUNCATE "RefreshToken" CASCADE;
TRUNCATE "User" CASCADE;
EOSQL

# Executar truncate
docker exec -i utop-postgres psql -U utop_user -d utop < /tmp/truncate.sql

# Restaurar backup
docker exec -i utop-postgres psql -U utop_user -d utop < /opt/utop/backup_inserts.sql

echo "Restauração concluída!"
