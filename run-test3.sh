#!/bin/bash
set -x

BACKEND_IP="172.18.0.4"
API_URL="http://${BACKEND_IP}:3000/api/v1"

echo "=== 1. LOGIN ==="
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"xxmaxx05@gmail.com","password":"Test123!"}')

echo "Login response: $LOGIN_RESPONSE"

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ]; then
  echo "ERRO: Nenhum token encontrado"
  exit 1
fi

echo "Token obtido: ${TOKEN:0:50}..."

echo ""
echo "=== 2. VERIFICANDO OFX FILE ==="
ls -la /tmp/nubank-test.ofx
head -20 /tmp/nubank-test.ofx

echo ""
echo "=== 3. IMPORT OFX ==="
IMPORT_RESPONSE=$(curl -s -X POST "${API_URL}/import/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/nubank-test.ofx" \
  -F "accountId=eb185468-6347-43cf-923f-bbdf2163cda3")

echo "Import response: $IMPORT_RESPONSE"

PREVIEW_ID=$(echo $IMPORT_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PREVIEW_ID" ]; then
  echo "ERRO: Preview ID não obtido"
  exit 1
fi

echo ""
echo "=== PREVIEW ID: $PREVIEW_ID ==="

echo ""
echo "=== 4. BATCH STATS ==="
STATS=$(curl -s -X GET "${API_URL}/import/batch-stats/$PREVIEW_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$STATS" | python3 -m json.tool 2>/dev/null || echo "$STATS"

echo ""
echo "=== 5. TRANSFER PAIRS ==="
PAIRS=$(curl -s -X GET "${API_URL}/import/transfer-pairs?batchId=$PREVIEW_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$PAIRS" | python3 -m json.tool 2>/dev/null || echo "$PAIRS"

echo ""
echo "=== 6. REVIEW - ALL (primeiras 50 transações) ==="
ALL=$(curl -s -X GET "${API_URL}/import/review/$PREVIEW_ID?limit=50" \
  -H "Authorization: Bearer $TOKEN")

echo "$ALL" | python3 -m json.tool 2>/dev/null || echo "$ALL"

echo ""
echo "=== TESTE CONCLUIDO ==="
echo "PREVIEW_ID=$PREVIEW_ID"
