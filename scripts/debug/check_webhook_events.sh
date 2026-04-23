#!/bin/bash
COMPOSE=/opt/utop/docker-compose.prod.yml
PG="docker compose -f $COMPOSE exec -T postgres psql -U utop_user -d utop"

echo "=== Eventos AsaasWebhookEvent (últimos 30 min) ==="
$PG -c "SELECT \"eventType\", status, \"receivedAt\" AT TIME ZONE 'America/Sao_Paulo' AS received_brt, \"processedAt\" AT TIME ZONE 'America/Sao_Paulo' AS processed_brt, \"lastError\" FROM \"AsaasWebhookEvent\" WHERE \"receivedAt\" > NOW() - INTERVAL '60 minutes' ORDER BY \"receivedAt\" DESC"

echo ""
echo "=== Logs recentes do backend (webhook routes + processor) ==="
docker compose -f $COMPOSE logs --tail=300 backend 2>&1 | grep -iE 'webhook|PAYMENT_|consumer' | tail -40
