#!/bin/bash
curl -X POST https://api.utopsistema.com.br/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"teste_log@teste.com","password":"Teste123!","fullName":"Teste Log"}' \
  -v
