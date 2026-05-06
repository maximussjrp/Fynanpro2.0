#!/bin/bash
set -euo pipefail
NEW_CHECKSUM="d3eb2b7366d19e029291d18065912e1c1ac841fece5f727c35c63741ab685e62"
NAME="20260425_partners_phase0_foundation"

echo "=== BEFORE ==="
docker exec utop-postgres psql -U utop_user -d utop -c \
  "SELECT migration_name, checksum, applied_steps_count, rolled_back_at FROM _prisma_migrations WHERE migration_name='$NAME';"

echo ""
echo "=== UPDATE ==="
docker exec utop-postgres psql -U utop_user -d utop -v ON_ERROR_STOP=1 -c \
  "UPDATE _prisma_migrations SET checksum='$NEW_CHECKSUM' WHERE migration_name='$NAME';"

echo ""
echo "=== AFTER ==="
docker exec utop-postgres psql -U utop_user -d utop -c \
  "SELECT migration_name, checksum, applied_steps_count, rolled_back_at, started_at, finished_at FROM _prisma_migrations WHERE migration_name='$NAME';"

echo ""
echo "=== EXPECTED checksum: $NEW_CHECKSUM ==="
