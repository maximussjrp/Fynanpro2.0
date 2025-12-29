#!/bin/bash
# Register xxmaxx05
echo "Registering xxmaxx05..."
curl -s -X POST https://api.utopsistema.com.br/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"xxmaxx05@gmail.com","password":"Senha123!","fullName":"Max Victor"}'
echo ""
