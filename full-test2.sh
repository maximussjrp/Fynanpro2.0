#!/bin/bash

BACKEND_IP="172.18.0.4"
API_URL="http://${BACKEND_IP}:3000/api/v1"
ACCOUNT_ID="eb185468-6347-43cf-923f-bbdf2163cda3"

echo "=== TESTE COMPLETO FASE 2.4 - OFX PIPELINE ==="
echo "Data: $(date)"
echo ""

# 1. LOGIN
echo "=== 1. LOGIN ==="
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"xxmaxx05@gmail.com","password":"Test123!"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERRO: Login falhou"
  exit 1
fi
echo "Token obtido: ${TOKEN:0:30}..."

# 2. IMPORT OFX
echo ""
echo "=== 2. IMPORTANDO OFX (Nubank Nov-Dez 2025) ==="
IMPORT_RESPONSE=$(curl -s -X POST "${API_URL}/import/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/nubank-test.ofx" \
  -F "accountId=${ACCOUNT_ID}")

# Salvar resposta
echo "$IMPORT_RESPONSE" > /tmp/import-response.json

PREVIEW_ID=$(echo $IMPORT_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Preview ID: $PREVIEW_ID"

# Parse dados
echo ""
echo "$IMPORT_RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    preview = data.get('preview', data)
    print('=== ESTATÍSTICAS DO IMPORT ===')
    print(f'Total transações: {preview.get(\"totalTransactions\", 0)}')
    print(f'Duplicatas detectadas: {preview.get(\"duplicates\", 0)}')
    print(f'Receitas: R\$ {preview.get(\"totalIncome\", 0):,.2f}')
    print(f'Despesas: R\$ {preview.get(\"totalExpense\", 0):,.2f}')
    
    items = preview.get('transactions', [])
    
    # Contar transferências
    transfers = [i for i in items if 'transferência' in i.get('description', '').lower() or 'pix' in i.get('description', '').lower()]
    invoice_payments = [i for i in items if 'pagamento de fatura' in i.get('description', '').lower()]
    
    print(f'')
    print('=== ANÁLISE DE PADRÕES ===')
    print(f'Transações com Transferência/PIX: {len(transfers)}')
    print(f'Pagamentos de fatura: {len(invoice_payments)}')
    
    # Mostrar pagamentos de fatura
    if invoice_payments:
        print('')
        print('=== PAGAMENTOS DE FATURA DETECTADOS ===')
        for p in invoice_payments:
            print(f\"  {p.get('date', '?')[:10]}: R\$ {p.get('amount', 0)} - {p.get('description', '?')[:60]}...\")
except Exception as e:
    print(f'Erro: {e}')
" <<< "$IMPORT_RESPONSE"

# 3. CONFIRMAR O IMPORT
echo ""
echo "=== 3. CONFIRMANDO IMPORT ==="

# Preparar transações para confirmar (todas que não são duplicatas)
TRANSACTIONS_JSON=$(echo "$IMPORT_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
preview = data.get('preview', data)
items = preview.get('transactions', [])
non_dup = [i for i in items if not i.get('isDuplicate', False)]
print(json.dumps(non_dup))
")

echo "Transações a confirmar: $(echo $TRANSACTIONS_JSON | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')"

# Fazer confirm
CONFIRM_BODY=$(python3 -c "
import json
preview_id = '${PREVIEW_ID}'
bank_id = '${ACCOUNT_ID}'
txs = ${TRANSACTIONS_JSON}
body = {
    'previewId': preview_id,
    'bankAccountId': bank_id,
    'transactions': txs
}
print(json.dumps(body))
")

CONFIRM_RESPONSE=$(curl -s -X POST "${API_URL}/import/confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "${CONFIRM_BODY}")

echo ""
echo "=== RESULTADO DA CONFIRMAÇÃO ==="
echo "$CONFIRM_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CONFIRM_RESPONSE"

# 4. Verificar dados no banco
echo ""
echo "=== 4. VERIFICANDO DADOS IMPORTADOS ==="
sleep 2

# Buscar imports
echo ""
echo "=== IMPORTS REGISTRADOS ==="
IMPORTS=$(curl -s -X GET "${API_URL}/import/history" \
  -H "Authorization: Bearer $TOKEN")
echo "$IMPORTS" | python3 -m json.tool 2>/dev/null || echo "$IMPORTS"

echo ""
echo "=== TESTE CONCLUÍDO ==="
