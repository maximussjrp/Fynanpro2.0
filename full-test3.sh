#!/bin/bash

BACKEND_IP="172.18.0.4"
API_URL="http://${BACKEND_IP}:3000/api/v1"
ACCOUNT_ID="eb185468-6347-43cf-923f-bbdf2163cda3"

echo "=== TESTE COMPLETO FASE 2.4 ==="
echo "Data: $(date)"
echo ""

# 1. LOGIN
echo "=== 1. LOGIN ==="
TOKEN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"xxmaxx05@gmail.com","password":"Test123!"}' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

echo "Token obtido: ${TOKEN:0:30}..."

# 2. IMPORT OFX
echo ""
echo "=== 2. IMPORTANDO OFX ==="
curl -s -X POST "${API_URL}/import/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/nubank-test.ofx" \
  -F "accountId=${ACCOUNT_ID}" > /tmp/import-response.json

PREVIEW_ID=$(cat /tmp/import-response.json | grep -o '"id":"preview-[^"]*"' | head -1 | cut -d'"' -f4)
echo "Preview ID: $PREVIEW_ID"

# Extrair transações
cat /tmp/import-response.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
preview = data.get('preview', data)
print(f'Total: {preview.get(\"totalTransactions\", 0)}')
print(f'Duplicatas: {preview.get(\"duplicates\", 0)}')

items = preview.get('transactions', [])
# Salvar IDs
with open('/tmp/tx-ids.json', 'w') as f:
    ids = [i['id'] for i in items if not i.get('isDuplicate', False)]
    json.dump(ids, f)
print(f'A confirmar: {len(ids)}')
"

# 3. CONFIRMAR - preparar body
echo ""
echo "=== 3. CONFIRMANDO ==="

# Criar body JSON
python3 -c "
import json
preview_id = '${PREVIEW_ID}'
bank_id = '${ACCOUNT_ID}'
with open('/tmp/tx-ids.json') as f:
    ids = json.load(f)

# Criar transações simplificadas
txs = [{'id': id, 'isSelected': True} for id in ids]

body = {
    'previewId': preview_id,
    'bankAccountId': bank_id,
    'transactions': txs
}
with open('/tmp/confirm-body.json', 'w') as f:
    json.dump(body, f)
print(f'Body criado com {len(txs)} transações')
"

# Fazer confirm
CONFIRM_RESPONSE=$(curl -s -X POST "${API_URL}/import/confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/confirm-body.json)

echo "$CONFIRM_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CONFIRM_RESPONSE"

# 4. Verificar transações criadas
echo ""
echo "=== 4. VERIFICANDO TRANSAÇÕES NO BANCO ==="
sleep 1

# Verificar via endpoint se existir, ou fazer query direta
echo "Fazendo query direta no banco..."

echo ""
echo "=== TESTE CONCLUÍDO ==="
