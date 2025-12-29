#!/bin/bash
# Test register endpoint first
echo "Registering user xxmaxx05..."
curl -s -X POST https://api.utopsistema.com.br/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"xxmaxx05@gmail.com","password":"Senha123!","fullName":"Max Admin"}'
echo ""
echo "---"
echo "Testing login xxmaxx05..."
curl -s -X POST https://api.utopsistema.com.br/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"xxmaxx05@gmail.com","password":"Senha123!"}'
echo ""
