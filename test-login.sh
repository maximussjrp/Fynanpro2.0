#!/bin/bash
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"max@dandara.app.br","password":"Max@777#"}'
