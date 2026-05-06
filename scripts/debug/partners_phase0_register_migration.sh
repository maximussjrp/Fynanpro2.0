#!/bin/bash
set -euo pipefail
CHK=$(sha256sum /opt/utop/backend/prisma/migrations/20260425_partners_phase0_foundation/migration.sql | awk '{print $1}')
echo "checksum=$CHK"
docker exec utop-postgres psql -U utop_user -d utop -v ON_ERROR_STOP=1 -c \
  "INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES (gen_random_uuid()::text, '$CHK', now(), '20260425_partners_phase0_foundation', NULL, NULL, now(), 1);"
echo "---verify---"
docker exec utop-postgres psql -U utop_user -d utop -t -c \
  "SELECT migration_name, applied_steps_count, finished_at FROM _prisma_migrations WHERE migration_name='20260425_partners_phase0_foundation';"
