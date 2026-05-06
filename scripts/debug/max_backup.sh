#!/bin/bash
# Backup pre-operacao — somente tabelas afetadas, escopo tenant Max
set -euo pipefail
T="eb21b270-170b-4c1e-83dc-2b4e49f22341"
TS=$(date +%Y%m%d_%H%M%S)
OUT="/opt/utop/backups/max_pre_reset_${TS}.sql"
mkdir -p /opt/utop/backups

echo "Backup em $OUT (tenant=$T)..."
docker exec utop-postgres pg_dump -U utop_user -d utop \
  --data-only \
  --table='"Transaction"' \
  --table='"RecurringBill"' \
  --table='"RecurringBillOccurrence"' \
  --table='"Installment"' \
  --table='"InstallmentPurchase"' \
  --table='"PaymentMethod"' \
  --table='"Category"' \
  --table='"CategorySemantics"' \
  --table='"BankAccount"' \
  --table='"Notification"' \
  > "$OUT"
ls -lh "$OUT"
echo "OK"
