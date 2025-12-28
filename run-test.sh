#!/bin/bash
set -e

echo "=== 1. LOGIN ==="
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"xxmaxx05@gmail.com","password":"123456"}')

echo "Login response: $LOGIN_RESPONSE"

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERRO: Token não obtido"
  exit 1
fi

echo "Token obtido: ${TOKEN:0:50}..."

echo ""
echo "=== 2. IMPORT OFX ==="
IMPORT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/import/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/nubank-test.ofx" \
  -F "accountId=eb185468-6347-43cf-923f-bbdf2163cda3")

echo "Import response: $IMPORT_RESPONSE"

PREVIEW_ID=$(echo $IMPORT_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PREVIEW_ID" ]; then
  echo "ERRO: Preview ID não obtido"
  exit 1
fi

echo "Preview ID: $PREVIEW_ID"

echo ""
echo "=== 3. BATCH STATS ==="
STATS=$(curl -s -X GET "http://localhost:3000/api/v1/import/batch-stats/$PREVIEW_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Batch Stats: $STATS"

echo ""
echo "=== 4. TRANSFER PAIRS ==="
PAIRS=$(curl -s -X GET "http://localhost:3000/api/v1/import/transfer-pairs?batchId=$PREVIEW_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Transfer Pairs: $PAIRS"

echo ""
echo "=== 5. REVIEW - TRANSFERS ==="
TRANSFERS=$(curl -s -X GET "http://localhost:3000/api/v1/import/review/$PREVIEW_ID?filter=transfers" \
  -H "Authorization: Bearer $TOKEN")

echo "Transfers: $TRANSFERS"

echo ""
echo "=== 6. REVIEW - INVOICE PAYMENTS ==="
INVOICES=$(curl -s -X GET "http://localhost:3000/api/v1/import/review/$PREVIEW_ID?filter=invoice_payments" \
  -H "Authorization: Bearer $TOKEN")

echo "Invoice Payments: $INVOICES"

echo ""
echo "=== TESTE CONCLUIDO ==="
