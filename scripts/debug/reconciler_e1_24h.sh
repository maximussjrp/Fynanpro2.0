#!/bin/bash
set -u
PSQL="docker exec -i utop-postgres psql -U utop_user -d utop -X"
NOW_UTC="$(date -u +%FT%TZ)"
START_UTC="$(date -u -d '24 hours ago' +%FT%TZ)"
echo "=== RECONCILER E1 24H CHECK TS_NOW=$NOW_UTC ==="
echo "WINDOW_START=$START_UTC WINDOW_END=$NOW_UTC"
echo
echo "--- [A] runs 24h ---"
echo 'SELECT mode,status,COUNT(*) AS runs,COALESCE(SUM("asaasApiCalls"),0) AS api_calls,COALESCE(SUM("asaasRateLimitHits"),0) AS rate_hits,COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM ("finishedAt"-"startedAt"))*1000)),0) AS avg_ms,COALESCE(ROUND(MAX(EXTRACT(EPOCH FROM ("finishedAt"-"startedAt"))*1000)),0) AS max_ms FROM "ReconciliationRun" WHERE "startedAt">NOW()-INTERVAL '"'"'24 hours'"'"' GROUP BY mode,status ORDER BY mode,status;' | $PSQL
echo
echo "--- [B] findings 24h by kind ---"
echo 'SELECT kind,COUNT(*) AS n FROM "ReconciliationFinding" WHERE "createdAt">NOW()-INTERVAL '"'"'24 hours'"'"' GROUP BY kind ORDER BY n DESC;' | $PSQL
echo
echo "--- [C] drift por tenant 24h (excl. IN_SYNC) ---"
echo 'SELECT "tenantId",kind,COUNT(*) AS n FROM "ReconciliationFinding" WHERE "createdAt">NOW()-INTERVAL '"'"'24 hours'"'"' AND kind<>'"'"'IN_SYNC'"'"' GROUP BY 1,2 ORDER BY n DESC LIMIT 50;' | $PSQL
echo
echo "--- [D] lastSuccessfulRunAt ---"
echo 'SELECT mode, MAX("finishedAt") AS last_success FROM "ReconciliationRun" WHERE status='"'"'success'"'"' AND mode IN ('"'"'dryrun'"'"','"'"'autofix'"'"') GROUP BY mode;' | $PSQL
echo 'SELECT MAX("finishedAt") AS last_finished_any FROM "ReconciliationRun";' | $PSQL
echo
echo "--- [E] rate-limit por hora 24h ---"
echo 'SELECT date_trunc('"'"'hour'"'"',"startedAt") AS h,COUNT(*) AS runs,COALESCE(SUM("asaasRateLimitHits"),0) AS rate_hits,COALESCE(SUM("asaasApiCalls"),0) AS api_calls,CASE WHEN COALESCE(SUM("asaasApiCalls"),0)=0 THEN 0 ELSE ROUND(100.0*COALESCE(SUM("asaasRateLimitHits"),0)/SUM("asaasApiCalls"),2) END AS pct FROM "ReconciliationRun" WHERE "startedAt">NOW()-INTERVAL '"'"'24 hours'"'"' GROUP BY 1 ORDER BY 1 DESC;' | $PSQL
echo
echo "--- [RAW] todas as runs 24h (detalhe) ---"
echo 'SELECT id,mode,status,"startedAt","finishedAt",ROUND(EXTRACT(EPOCH FROM ("finishedAt"-"startedAt"))*1000) AS ms,"asaasApiCalls","asaasRateLimitHits","tenantsScanned","subscriptionsScanned","findingsCount","errorMessage" FROM "ReconciliationRun" WHERE "startedAt">NOW()-INTERVAL '"'"'24 hours'"'"' ORDER BY "startedAt" ASC;' | $PSQL
echo
echo "--- [UNIVERSE] tenants asaas ---"
echo 'SELECT COUNT(*) AS tenants_asaas FROM "Tenant" WHERE "billingSource"='"'"'asaas'"'"';' | $PSQL
echo "--- [UNIVERSE] subscriptions asaas elegíveis (active/past_due/suspended/cancelled) ---"
echo 'SELECT s.status,COUNT(*) AS n FROM "Subscription" s JOIN "Tenant" t ON t.id=s."tenantId" WHERE s.provider='"'"'asaas'"'"' AND t."billingSource"='"'"'asaas'"'"' AND s.status IN ('"'"'active'"'"','"'"'past_due'"'"','"'"'suspended'"'"','"'"'cancelled'"'"') GROUP BY s.status ORDER BY n DESC;' | $PSQL
echo
echo "--- [ENV] FF_ASAAS_RECONCILER_* ---"
docker exec utop-backend sh -c 'printenv | grep -E "^FF_ASAAS_RECONCILER" | sort'
echo
echo "--- [LOG] metric:reconciler.run últimas 24h (tail 80) ---"
docker logs utop-backend --since 24h 2>&1 | grep -E "metric:reconciler\.run|reconciler\.tick|reconciler\.start|reconciler\.finish" | tail -80
echo
echo "--- [LOG] warn/error/fail/stack relacionados a reconciler últimas 24h ---"
docker logs utop-backend --since 24h 2>&1 | grep -iE "reconcil|ReconcilerAutofixGuardError|rate.?limit|429" | grep -iE "warn|error|fail|exception|stack|guard|429" | tail -80 || echo "(no matches)"
echo
echo "--- [LOG] ReconcilerAutofixGuardError em qualquer lugar (24h) ---"
docker logs utop-backend --since 24h 2>&1 | grep -E "ReconcilerAutofixGuardError" | tail -40 || echo "(no matches)"
echo
echo "--- [LOG] todas as linhas reconcil (24h, tail 30) ---"
docker logs utop-backend --since 24h 2>&1 | grep -i "reconcil" | tail -30
echo
echo "=== FIM E1 24H CHECK ==="
