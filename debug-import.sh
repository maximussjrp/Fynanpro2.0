#!/bin/bash

BACKEND_IP="172.18.0.4"
API_URL="http://${BACKEND_IP}:3000/api/v1"

# LOGIN
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"xxmaxx05@gmail.com","password":"Test123!"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo "Token: ${TOKEN:0:30}..."

# IMPORT
echo ""
echo "=== IMPORT RAW RESPONSE (primeiros 3000 chars) ==="
IMPORT_RESPONSE=$(curl -s -X POST "${API_URL}/import/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/nubank-test.ofx" \
  -F "accountId=eb185468-6347-43cf-923f-bbdf2163cda3")

echo "${IMPORT_RESPONSE:0:3000}"

echo ""
echo "=== TAMANHO DO RESPONSE ==="
echo "Bytes: ${#IMPORT_RESPONSE}"

echo ""
echo "=== CONTANDO ITEMS ==="
echo "$IMPORT_RESPONSE" | grep -o '"isDuplicate":true' | wc -l
echo "$IMPORT_RESPONSE" | grep -o '"isDuplicate":false' | wc -l
