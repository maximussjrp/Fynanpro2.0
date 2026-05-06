#!/bin/bash
set -u
PSQL="docker exec -i utop-postgres psql -U utop_user -d utop -X -A -F$'\t'"
echo "=== RECONCILER E1 DAY-1 TS: $(date -u +%FT%TZ) ==="
echo
echo "--- [A] runs 24h (mode,status,runs,api_calls,rate_hits,avg_ms,max_ms) ---"
echo 'SELECT mode,status,COUNT(*) AS runs,COALESCE(SUM("asaasApiCalls"),0) AS api_calls,COALESCE(SUM("asaasRateLimitHits"),0) AS rate_hits,COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM ("finishedAt"-"startedAt"))*1000)),0) AS avg_ms,COALESCE(ROUND(MAX(EXTRACT(EPOCH FROM ("finishedAt"-"startedAt"))*1000)),0) AS max_ms FROM "ReconciliationRun" WHERE "startedAt">NOW()-INTERVAL '"'"'24 hours'"'"' GROUP BY mode,status ORDER BY mode,status;' | $PSQL
echo
echo "--- [B] findings 24h by kind ---"
echo 'SELECT kind,COUNT(*) AS n FROM "ReconciliationFinding" WHERE "createdAt">NOW()-INTERVAL '"'"'24 hours'"'"' GROUP BY kind ORDER BY n DESC;' | $PSQL
echo
echo "--- [C] drift por tenant 24h (excl. IN_SYNC) ---"
echo 'SELECT "tenantId",kind,COUNT(*) AS n FROM "ReconciliationFinding" WHERE "createdAt">NOW()-INTERVAL '"'"'24 hours'"'"' AND kind<>'"'"'IN_SYNC'"'"' GROUP BY 1,2 ORDER BY n DESC LIMIT 20;' | $PSQL
echo
echo "--- [D] lastSuccessfulRunAt ---"
echo 'SELECT MAX("finishedAt") AS last_success_dryrun_or_autofix FROM "ReconciliationRun" WHERE status='"'"'success'"'"' AND mode IN ('"'"'dryrun'"'"','"'"'autofix'"'"');' | $PSQL
echo 'SELECT MAX("finishedAt") AS last_finished_any FROM "ReconciliationRun";' | $PSQL
echo
echo "--- [E] rate-limit + api por hora 24h ---"
echo 'SELECT date_trunc('"'"'hour'"'"',"startedAt") AS h,COUNT(*) AS runs,SUM("asaasRateLimitHits") AS rate_hits,SUM("asaasApiCalls") AS api_calls FROM "ReconciliationRun" WHERE "startedAt">NOW()-INTERVAL '"'"'24 hours'"'"' GROUP BY 1 ORDER BY 1 DESC;' | $PSQL
echo
echo "--- [RAW] últimas 5 runs (detalhe) ---"
echo 'SELECT id,mode,status,"startedAt","finishedAt","asaasApiCalls","asaasRateLimitHits","tenantsScanned","subscriptionsScanned","findingsCount","errorMessage" FROM "ReconciliationRun" ORDER BY "startedAt" DESC LIMIT 5;' | $PSQL
echo
echo "--- [UNIVERSE] tenants asaas ---"
echo 'SELECT COUNT(*) AS tenants_asaas FROM "Tenant" WHERE "billingSource"='"'"'asaas'"'"';' | $PSQL
echo "--- [UNIVERSE] subscriptions asaas por status ---"
echo 'SELECT s.status,COUNT(*) AS n FROM "Subscription" s JOIN "Tenant" t ON t.id=s."tenantId" WHERE s.provider='"'"'asaas'"'"' AND t."billingSource"='"'"'asaas'"'"' GROUP BY s.status ORDER BY n DESC;' | $PSQL
echo "--- [UNIVERSE] subscriptions asaas elegíveis ao scan (active/past_due/suspended/cancelled) ---"
echo 'SELECT s.id,s."tenantId",s.status,s."asaasSubscriptionId" FROM "Subscription" s JOIN "Tenant" t ON t.id=s."tenantId" WHERE s.provider='"'"'asaas'"'"' AND t."billingSource"='"'"'asaas'"'"' AND s.status IN ('"'"'active'"'"','"'"'past_due'"'"','"'"'suspended'"'"','"'"'cancelled'"'"') ORDER BY s."createdAt" DESC;' | $PSQL
echo
echo "--- [ENV] FF_ASAAS_RECONCILER_* no container backend ---"
docker exec utop-backend sh -c 'printenv | grep -E "^FF_ASAAS_RECONCILER" | sort'
echo
echo "--- [LOG] metric:reconciler.run (últimas 90m) ---"
docker logs utop-backend --since 90m 2>&1 | grep -E "metric:reconciler\.run|reconciler\.tick|reconciler\.start|reconciler\.finish" | tail -40
echo
echo "--- [LOG] qualquer erro/warning/rate-limit/stack reconciler (últimas 90m) ---"
docker logs utop-backend --since 90m 2>&1 | grep -iE "reconcil|rate.?limit|429" | grep -iE "error|warn|fail|rate|429|stack|exception" | tail -40
echo
echo "--- [LOG] todas as linhas com 'reconcil' (últimas 90m, tail 60) ---"
docker logs utop-backend --since 90m 2>&1 | grep -i "reconcil" | tail -60
echo
echo "=== FIM E1 DAY-1 ==="
