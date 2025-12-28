#!/bin/bash

BACKEND_IP="172.18.0.4"
API_URL="http://${BACKEND_IP}:3000/api/v1"

echo "=== VALIDAÇÃO FASE 2.4 - OFX PIPELINE ==="
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
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "Token obtido: ${TOKEN:0:30}..."
echo ""

# 2. Verificar imports existentes
echo "=== 2. IMPORTS EXISTENTES ==="
EXISTING=$(curl -s -X GET "${API_URL}/import/batches?limit=5" \
  -H "Authorization: Bearer $TOKEN")

echo "$EXISTING" | python3 -m json.tool 2>/dev/null || echo "$EXISTING"
echo ""

# 3. Tentar importar o arquivo OFX (vai detectar como duplicatas)
echo "=== 3. IMPORT OFX (teste de dedupe) ==="
IMPORT_RESPONSE=$(curl -s -X POST "${API_URL}/import/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/nubank-test.ofx" \
  -F "accountId=eb185468-6347-43cf-923f-bbdf2163cda3")

# Parse preview id
PREVIEW_ID=$(echo $IMPORT_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Preview ID: $PREVIEW_ID"

# Parse summary
echo ""
echo "=== 4. ANÁLISE DO IMPORT ==="
echo "$IMPORT_RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    summary = data.get('summary', {})
    print('=== RESUMO DO IMPORT ===')
    print(f'Total de transações: {data.get(\"totalTransactions\", \"?\")}')
    print(f'Criadas: {summary.get(\"created\", 0)}')
    print(f'Duplicadas (dedupe): {summary.get(\"deduped\", 0)}')
    print(f'Pares de transferência: {summary.get(\"transferPairs\", 0)}')
    print(f'Pagamentos de fatura: {summary.get(\"invoicePayments\", 0)}')
    print(f'Excluídas de energia: {summary.get(\"excludedFromEnergy\", 0)}')
    print(f'Precisam revisão: {summary.get(\"needsReview\", 0)}')
    
    # Check transfers
    items = data.get('items', [])
    transfers = [i for i in items if i.get('isTransfer')]
    duplicates = [i for i in items if i.get('isDuplicate')]
    invoice_payments = [i for i in items if 'fatura' in i.get('description', '').lower()]
    
    print(f'')
    print(f'=== DETALHES ===')
    print(f'Transações totais: {len(items)}')
    print(f'Marcadas como transferência: {len(transfers)}')
    print(f'Marcadas como duplicata: {len(duplicates)}')
    print(f'Com fatura no nome: {len(invoice_payments)}')
    
    # Show sample duplicates
    if duplicates:
        print(f'')
        print('=== AMOSTRAS DE DUPLICATAS (primeiras 5) ===')
        for d in duplicates[:5]:
            print(f\"  - {d.get('date', '?')[:10]}: {d.get('description', '?')[:60]}... R\$ {d.get('amount', 0)}\")
            print(f\"    duplicateOf: {d.get('duplicateOf', 'N/A')}\")
    
    # Show invoice payments
    if invoice_payments:
        print(f'')
        print('=== PAGAMENTOS DE FATURA ===')
        for i in invoice_payments[:5]:
            print(f\"  - {i.get('date', '?')[:10]}: {i.get('description', '?')[:60]}... R\$ {i.get('amount', 0)}\")
            
except Exception as e:
    print(f'Erro ao parsear: {e}')
    print(sys.stdin.read())
" <<< "$IMPORT_RESPONSE"

# 5. Buscar estatísticas de batch existente
echo ""
echo "=== 5. BATCH STATS DE IMPORT EXISTENTE ==="
# Pegar primeiro import existente
FIRST_BATCH=$(echo "$EXISTING" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$FIRST_BATCH" ]; then
  echo "Batch ID: $FIRST_BATCH"
  BATCH_STATS=$(curl -s -X GET "${API_URL}/import/batch-stats/${FIRST_BATCH}" \
    -H "Authorization: Bearer $TOKEN")
  echo "$BATCH_STATS" | python3 -m json.tool 2>/dev/null || echo "$BATCH_STATS"
else
  echo "Nenhum batch existente encontrado"
fi

# 6. Transfer pairs do import existente
echo ""
echo "=== 6. TRANSFER PAIRS DE IMPORT EXISTENTE ==="
if [ -n "$FIRST_BATCH" ]; then
  PAIRS=$(curl -s -X GET "${API_URL}/import/transfer-pairs?batchId=${FIRST_BATCH}" \
    -H "Authorization: Bearer $TOKEN")
  echo "$PAIRS" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(f'Total de pares: {data.get(\"count\", 0)}')
    print(f'Pares válidos: {data.get(\"validPairs\", 0)}')
    print(f'Pares inválidos: {data.get(\"invalidPairs\", 0)}')
    
    pairs = data.get('pairs', [])
    if pairs:
        print('')
        print('=== AMOSTRAS DE PARES (primeiros 5) ===')
        for p in pairs[:5]:
            sent = p.get('sent', {})
            received = p.get('received', {})
            print(f\"  Par:\")
            print(f\"    Enviado: {sent.get('date', '?')[:10]} - R\$ {sent.get('amount', 0)}\")
            print(f\"    Recebido: {received.get('date', '?')[:10]} - R\$ {received.get('amount', 0)}\")
            print(f\"    Confidence: {p.get('confidence', '?')}\")
except Exception as e:
    print(f'Erro: {e}')
" 2>/dev/null || echo "$PAIRS"
fi

echo ""
echo "=== VALIDAÇÃO CONCLUÍDA ==="
