#!/bin/bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "xxmaxx05@gmail.com", "password": "123456"}' | jq -r '.accessToken')

echo "TOKEN: $TOKEN"
