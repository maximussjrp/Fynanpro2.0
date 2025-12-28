#!/bin/bash
cd /opt/utop
UUID=$(cat /proc/sys/kernel/random/uuid)
docker compose -f docker-compose.prod.yml exec -e PGPASSWORD=Xt9sK2mNpW7qJ4bLhY6cR3vF -T postgres psql -h localhost -U utop_user -d utop -c "INSERT INTO \"_prisma_migrations\" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('$UUID', 'fase24_manual_apply', NOW(), '20251228123742_fase24_ofx_pipeline', NULL, NULL, NOW(), 1);"
