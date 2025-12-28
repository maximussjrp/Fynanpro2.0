#!/bin/bash

BACKEND_IP="172.18.0.4"
API_URL="http://${BACKEND_IP}:3000/api/v1"
ACCOUNT_ID="eb185468-6347-43cf-923f-bbdf2163cda3"

echo "=== TESTE FASE 2.4 - OFX PIPELINE DIRETO ==="
echo "Data: $(date)"
echo ""

# 1. LOGIN
echo "=== 1. LOGIN ==="
TOKEN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"xxmaxx05@gmail.com","password":"Test123!"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

echo "Token: ${TOKEN:0:30}..."

# 2. Limpar transações anteriores (soft delete)
echo ""
echo "=== 2. LIMPANDO TRANSAÇÕES ANTERIORES ==="
# Isso será feito via SQL no próximo passo

# 3. IMPORT usando /import/ofx (com pipeline completo)
echo ""
echo "=== 3. IMPORTANDO OFX COM PIPELINE COMPLETO ==="
IMPORT_RESPONSE=$(curl -s -X POST "${API_URL}/import/ofx" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/nubank-test.ofx" \
  -F "accountId=${ACCOUNT_ID}")

echo "Response:"
echo "$IMPORT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$IMPORT_RESPONSE"

# Extrair batchId
BATCH_ID=$(echo $IMPORT_RESPONSE | grep -o '"batchId":"[^"]*"' | cut -d'"' -f4)
echo ""
echo "Batch ID: $BATCH_ID"

# 4. Verificar batch stats
if [ -n "$BATCH_ID" ]; then
  echo ""
  echo "=== 4. BATCH STATS ==="
  STATS=$(curl -s -X GET "${API_URL}/import/batch-stats/${BATCH_ID}" \
    -H "Authorization: Bearer $TOKEN")
  echo "$STATS" | python3 -m json.tool 2>/dev/null || echo "$STATS"
  
  echo ""
  echo "=== 5. TRANSFER PAIRS ==="
  PAIRS=$(curl -s -X GET "${API_URL}/import/transfer-pairs?batchId=${BATCH_ID}" \
    -H "Authorization: Bearer $TOKEN")
  echo "$PAIRS" | python3 -m json.tool 2>/dev/null || echo "$PAIRS"
  
  echo ""
  echo "=== 6. REVIEW ITEMS (primeiros 10) ==="
  REVIEW=$(curl -s -X GET "${API_URL}/import/review/${BATCH_ID}?limit=10" \
    -H "Authorization: Bearer $TOKEN")
  echo "$REVIEW" | python3 -m json.tool 2>/dev/null || echo "$REVIEW"
fi

echo ""
echo "=== TESTE CONCLUÍDO ==="
