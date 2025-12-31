#!/bin/bash

# Login and get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"max.hsartory@gmail.com","password":"Maxmax1!"}' | \
  grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

echo "Token: ${TOKEN:0:50}..."

# Test transactions API
echo ""
echo "Testing transactions for January 2026..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/transactions?startDate=2026-01-01&endDate=2026-01-31" | \
  jq '{
    total: .pagination.total,
    count: (.data | length),
    transactions: [.data[] | {description, date: .transactionDate, status}]
  }'
