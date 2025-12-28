#!/bin/bash

BACKEND_IP="172.18.0.4"
API_URL="http://${BACKEND_IP}:3000/api/v1"

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
  -F "accountId=eb185468-6347-43cf-923f-bbdf2163cda3")

# Salvar resposta para análise
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
    debit_purchases = [i for i in items if 'compra no débito' in i.get('description', '').lower()]
    
    print('')
    print('=== ANÁLISE DE PADRÕES ===')
    print(f'Transações com Transferência/PIX: {len(transfers)}')
    print(f'Pagamentos de fatura: {len(invoice_payments)}')
    print(f'Compras no débito: {len(debit_purchases)}')
    
    # Mostrar pagamentos de fatura
    if invoice_payments:
        print('')
        print('=== PAGAMENTOS DE FATURA DETECTADOS ===')
        for p in invoice_payments:
            print(f\"  {p.get('date', '?')[:10]}: R\$ {p.get('amount', 0)} - {p.get('description', '?')[:60]}...\")
    
    # Mostrar algumas transferências
    print('')
    print('=== AMOSTRAS DE TRANSFERÊNCIAS ===')
    sent = [t for t in transfers if 'enviada' in t.get('description', '').lower()]
    received = [t for t in transfers if 'recebida' in t.get('description', '').lower()]
    print(f'  Enviadas: {len(sent)}')
    print(f'  Recebidas: {len(received)}')
    
except Exception as e:
    print(f'Erro: {e}')
" <<< "$IMPORT_RESPONSE"

# 3. CONFIRMAR O IMPORT
echo ""
echo "=== 3. CONFIRMANDO IMPORT ==="

# Preparar os IDs das transações selecionadas
SELECTED_IDS=$(echo "$IMPORT_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
preview = data.get('preview', data)
items = preview.get('transactions', [])
# Selecionar todas que não são duplicatas
non_dup = [i['id'] for i in items if not i.get('isDuplicate', False)]
print(','.join(['\"' + id + '\"' for id in non_dup]))
")

echo "Transações a confirmar: $(echo $SELECTED_IDS | tr ',' '\n' | wc -l)"

# Fazer confirm
CONFIRM_RESPONSE=$(curl -s -X POST "${API_URL}/import/confirm/${PREVIEW_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"selectedIds\": [${SELECTED_IDS}]}")

echo "$CONFIRM_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CONFIRM_RESPONSE"

# 4. Verificar dados no banco
echo ""
echo "=== 4. VERIFICANDO DADOS IMPORTADOS ==="
sleep 2

# Buscar batch stats
BATCH_ID=$(echo $CONFIRM_RESPONSE | grep -o '"batchId":"[^"]*"' | cut -d'"' -f4)
if [ -n "$BATCH_ID" ]; then
  echo "Batch ID: $BATCH_ID"
  
  STATS=$(curl -s -X GET "${API_URL}/import/batch-stats/${BATCH_ID}" \
    -H "Authorization: Bearer $TOKEN")
  
  echo ""
  echo "=== BATCH STATS ==="
  echo "$STATS" | python3 -m json.tool 2>/dev/null || echo "$STATS"
  
  echo ""
  echo "=== TRANSFER PAIRS ==="
  PAIRS=$(curl -s -X GET "${API_URL}/import/transfer-pairs?batchId=${BATCH_ID}" \
    -H "Authorization: Bearer $TOKEN")
  echo "$PAIRS" | python3 -m json.tool 2>/dev/null || echo "$PAIRS"
fi

echo ""
echo "=== TESTE CONCLUÍDO ==="
