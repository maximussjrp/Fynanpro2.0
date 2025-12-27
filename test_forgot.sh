#!/bin/bash
curl -s -X POST https://api.utopsistema.com.br/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"dandarasv@outlook.com"}'
