#!/bin/bash

# Test login
echo "Testing login..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"max.hsartory@gmail.com","password":"Maxmax1!"}')

echo "$RESPONSE"
