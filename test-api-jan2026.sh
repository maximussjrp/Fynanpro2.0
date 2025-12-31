#!/bin/bash

# Test API to verify scheduled transactions are filtered out
# Should return only 5 transactions (not 8)

curl -s -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0YzhmZjcxOS01YjdhLTRiNjktOTNmYS0xYWVmN2UyYWQ0NGQiLCJ0ZW5hbnRJZCI6IjRjOGZmNzE5LTViN2EtNGI2OS05M2ZhLTFhZWY3ZTJhZDQ0ZCIsImVtYWlsIjoibWF4LmhzYXJ0b3J5QGdtYWlsLmNvbSIsImlhdCI6MTczNTU4OTI5MSwiZXhwIjoxNzM4MTgxMjkxfQ.cnQcZQWW7yVLr8xSi2WJ-tH_I6IpR8uJ6Gkn4_5TZzw" \
  "https://utop.com.br/api/v1/transactions?startDate=2026-01-01&endDate=2026-01-31" | jq '{count: (.data | length), transactions: [.data[] | {description, date: .transactionDate, status}]}'
