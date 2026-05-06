#!/bin/bash
set -uo pipefail
echo "=== migration enums in source ==="
grep -c 'CREATE TYPE' /opt/utop/backend/prisma/migrations/20260425_partners_phase0_foundation/migration.sql
grep -oE 'CREATE TYPE "[A-Za-z]+"' /opt/utop/backend/prisma/migrations/20260425_partners_phase0_foundation/migration.sql | sort

echo ""
echo "=== seed (correct cols) ==="
docker exec utop-postgres psql -U utop_user -d utop -c 'SELECT id, name, "priceCents", active FROM partner_courses;'

echo ""
echo "=== healthcheck ==="
docker inspect --format '{{.State.Health.Status}}' utop-backend

echo ""
echo "=== logs last 5min (errors) ==="
docker logs utop-backend --since 5m 2>&1 | grep -iE 'error|fatal|partner' | head -20 || echo "(no error lines)"

echo ""
echo "=== /api/partners/me (expect 404) ==="
docker exec utop-backend node -e "const http=require('http');http.get('http://localhost:3001/api/partners/me',r=>{console.log('status='+r.statusCode);let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log('body='+d.substring(0,200)))}).on('error',e=>console.log('ERR',e.message))"

echo ""
echo "=== /health (expect 200) ==="
docker exec utop-backend node -e "const http=require('http');http.get('http://localhost:3001/health',r=>{console.log('status='+r.statusCode);let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log('body='+d.substring(0,200)))}).on('error',e=>console.log('ERR',e.message))"

echo ""
echo "=== Tenant/User/ConsultantProfile counts (sanity) ==="
docker exec utop-postgres psql -U utop_user -d utop -c "SELECT (SELECT count(*) FROM \"User\") AS users, (SELECT count(*) FROM \"Tenant\") AS tenants, (SELECT count(*) FROM \"ConsultantProfile\") AS consultants, (SELECT count(*) FROM \"Transaction\") AS transactions;"
