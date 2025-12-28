#!/bin/bash
set -e

# Install jq if not present
which jq > /dev/null 2>&1 || apt-get install -y jq > /dev/null 2>&1

# Login
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "xxmaxx05@gmail.com", "password": "123456"}')

echo "Login response:"
echo "$RESPONSE"

TOKEN=$(echo "$RESPONSE" | jq -r '.accessToken // empty')

if [ -z "$TOKEN" ]; then
  echo "ERROR: Could not get token"
  exit 1
fi

echo ""
echo "TOKEN obtained successfully"
echo "TOKEN=$TOKEN" > /tmp/token.txt

# Now import the OFX file
ACCOUNT_ID="eb185468-6347-43cf-923f-bbdf2163cda3"

echo ""
echo "Importing OFX file..."
IMPORT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/import/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/nubank-test.ofx" \
  -F "accountId=$ACCOUNT_ID")

echo "Import response:"
echo "$IMPORT_RESPONSE" | jq .

# Extract preview ID
PREVIEW_ID=$(echo "$IMPORT_RESPONSE" | jq -r '.preview.id // empty')

if [ -z "$PREVIEW_ID" ]; then
  echo "ERROR: Could not get preview ID"
  exit 1
fi

echo ""
echo "Preview ID: $PREVIEW_ID"
echo "PREVIEW_ID=$PREVIEW_ID" >> /tmp/token.txt
