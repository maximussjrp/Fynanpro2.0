#!/bin/bash
# Snapshot do estado dos Tenants ANTES da migration C5.0.
# Gera JSON com (id, subscriptionStatus, subscriptionPlan, trialEndsAt, stripeSubscriptionId).
# Usado depois para comparação pós-migration (nenhum subscriptionStatus deve mudar).
COMPOSE=/opt/utop/docker-compose.prod.yml
docker compose -f $COMPOSE exec -T postgres psql -U utop_user -d utop -A -F$'\t' -t -c \
"SELECT id, \"subscriptionStatus\", \"subscriptionPlan\", \"trialEndsAt\", \"stripeSubscriptionId\" FROM \"Tenant\" ORDER BY id"
