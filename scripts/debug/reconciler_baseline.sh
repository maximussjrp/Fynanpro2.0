#!/bin/bash
set -u
PSQL="docker exec -i utop-postgres psql -U utop_user -d utop"
echo "=== BASELINE E0 TS: $(date -u +%FT%TZ) ==="
echo
echo "--- [A] runs 24h ---"
echo 'SELECT mode,status,COUNT(*) AS runs,COALESCE(SUM("asaasApiCalls"),0) AS api_calls,COALESCE(SUM("asaasRateLimitHits"),0) AS rate_hits FROM "ReconciliationRun" WHERE "startedAt">NOW()-INTERVAL '"'"'24 hours'"'"' GROUP BY mode,status;' | $PSQL
echo "--- [B] findings 24h by kind ---"
echo 'SELECT kind,COUNT(*) AS n FROM "ReconciliationFinding" WHERE "createdAt">NOW()-INTERVAL '"'"'24 hours'"'"' GROUP BY kind ORDER BY n DESC;' | $PSQL
echo "--- [C] drift por tenant 24h ---"
echo 'SELECT "tenantId",kind,COUNT(*) AS n FROM "ReconciliationFinding" WHERE "createdAt">NOW()-INTERVAL '"'"'24 hours'"'"' AND kind<>'"'"'IN_SYNC'"'"' GROUP BY 1,2 ORDER BY n DESC LIMIT 20;' | $PSQL
echo "--- [D] lastSuccessfulRunAt (signal C5.3) ---"
echo 'SELECT MAX("finishedAt") AS last_success_dryrun FROM "ReconciliationRun" WHERE status='"'"'success'"'"' AND mode IN ('"'"'dryrun'"'"','"'"'autofix'"'"');' | $PSQL
echo "--- [E] rate-limit por hora 24h ---"
echo 'SELECT date_trunc('"'"'hour'"'"',"startedAt") AS h,SUM("asaasRateLimitHits") AS rate_hits,SUM("asaasApiCalls") AS api_calls FROM "ReconciliationRun" WHERE "startedAt">NOW()-INTERVAL '"'"'24 hours'"'"' GROUP BY 1 ORDER BY 1 DESC;' | $PSQL
echo "--- [UNIVERSE] subscriptions asaas elegíveis ao scan ---"
echo 'SELECT s.status,COUNT(*) AS n FROM "Subscription" s JOIN "Tenant" t ON t.id=s."tenantId" WHERE s.provider='"'"'asaas'"'"' AND t."billingSource"='"'"'asaas'"'"' AND s.status IN ('"'"'active'"'"','"'"'past_due'"'"','"'"'suspended'"'"','"'"'cancelled'"'"') GROUP BY s.status ORDER BY n DESC;' | $PSQL
echo "--- [UNIVERSE] tenants asaas ---"
echo 'SELECT COUNT(*) AS tenants_asaas FROM "Tenant" WHERE "billingSource"='"'"'asaas'"'"';' | $PSQL
echo "--- [MIGRATION] aplicada ---"
echo "SELECT migration_name,finished_at FROM _prisma_migrations WHERE migration_name LIKE '%c5_4%';" | $PSQL
echo "--- [ENV] FF reconciler (esperado: vazio = OFF default) ---"
docker exec utop-backend sh -c 'printenv | grep -iE "^FF_ASAAS_RECONCILER" || echo "(nenhuma FF_ASAAS_RECONCILER_* setada)"'
echo "--- [LOG] startup reconciler (últimos 10m) ---"
docker logs utop-backend --since 10m 2>&1 | grep -iE "reconcil" | tail -10
echo "--- [HEALTH] ---"
curl -sS http://localhost:3001/health 2>/dev/null || curl -sS https://api.utopsistema.com.br/health
echo
echo "=== FIM BASELINE E0 ==="
