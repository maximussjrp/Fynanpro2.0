#!/bin/bash
for i in 1 2 3 4 5 6; do
  echo "=== Tentativa $i ==="
  curl -s -X POST https://api.utopsistema.com.br/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"teste_rate@teste.com","password":"errada"}'
  echo
  sleep 1
done
