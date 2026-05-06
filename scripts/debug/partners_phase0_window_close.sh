#!/bin/bash
set -uo pipefail
echo "=== containers ==="
docker ps --format '{{.Names}}\t{{.Status}}' | grep utop

echo ""
echo "=== partner_* tables count (expect 15) ==="
docker exec utop-postgres psql -U utop_user -d utop -t -c "SELECT count(*) FROM pg_tables WHERE tablename LIKE 'partner_%';"

echo "=== _prisma_migrations checksum (expect d3eb2b73...) ==="
docker exec utop-postgres psql -U utop_user -d utop -c "SELECT migration_name, checksum, applied_steps_count, rolled_back_at FROM _prisma_migrations WHERE migration_name='20260425_partners_phase0_foundation';"

echo "=== seed (expect crs_partner_v1) ==="
docker exec utop-postgres psql -U utop_user -d utop -c "SELECT id, name, \"priceCents\", active FROM partner_courses;"

echo "=== healthcheck ==="
docker inspect --format '{{.State.Health.Status}}' utop-backend

echo "=== FF_PARTNERS_* (expect empty) ==="
docker exec utop-backend env | grep '^FF_PARTNERS' || echo "(none — OFF as expected)"

echo "=== backend logs since 24h: error/fatal/partner counts ==="
docker logs utop-backend --since 24h 2>&1 | grep -ciE 'error|fatal' | head -1
docker logs utop-backend --since 24h 2>&1 | grep -ci 'partner' | head -1

echo "=== nginx /api/partners/me (expect 404) ==="
curl -sS -k -o /dev/null -w "HTTPS=%{http_code}\n" https://localhost/api/partners/me 2>&1 || true

echo "=== row counts in partner_* (expect course=1, others=0) ==="
docker exec utop-postgres psql -U utop_user -d utop -c "SELECT 'partner_courses' AS t, count(*) FROM partner_courses UNION ALL SELECT 'partner_referral_links', count(*) FROM partner_referral_links UNION ALL SELECT 'partner_enrollments', count(*) FROM partner_enrollments UNION ALL SELECT 'partner_commissions', count(*) FROM partner_commissions UNION ALL SELECT 'partner_audit_logs', count(*) FROM partner_audit_logs;"
