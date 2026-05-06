#!/bin/bash
set -uo pipefail
echo "=== backend PORT env ==="
docker exec utop-backend printenv PORT || echo "(PORT unset)"

echo ""
echo "=== container partner code (should be empty) ==="
docker exec utop-backend sh -c "grep -rli 'partner' /app/dist /app/src 2>/dev/null | grep -v node_modules | head" || true
echo "(end)"

echo ""
echo "=== nginx /api/health ==="
curl -fsS -k -o /dev/null -w "HTTPS=%{http_code}\n" https://localhost/api/health 2>&1 || true
curl -fsS    -o /dev/null -w "HTTP =%{http_code}\n" http://localhost/api/health 2>&1 || true

echo ""
echo "=== nginx /api/partners/me (expect 404) ==="
curl -sS -k -o /dev/null -w "HTTPS=%{http_code}\n" https://localhost/api/partners/me 2>&1 || true
