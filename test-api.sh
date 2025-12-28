#!/bin/bash
# Test register endpoint first
echo "Registering user..."
curl -s -X POST https://api.utopsistema.com.br/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"m2nivel.contato@gmail.com","password":"Agor@135","fullName":"M2 Nivel"}'
echo ""
echo "---"
echo "Testing login..."
curl -s -X POST https://api.utopsistema.com.br/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"m2nivel.contato@gmail.com","password":"Agor@135"}'
echo ""
