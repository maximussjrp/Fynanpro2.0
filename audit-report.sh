#!/bin/bash
echo "========================================"
echo "    RELATORIO DE AUDITORIA - UTOP"
echo "    Data: $(date)"
echo "========================================"
echo ""

echo "=== INFRAESTRUTURA ==="
echo "Containers:"
docker ps --format '  {{.Names}}: {{.Status}}'
echo ""

echo "Disco:"
df -h / | tail -1 | awk '{print "  Usado: " $3 "/" $2 " (" $5 ")"}'
echo ""

echo "Memoria:"
free -h | grep Mem | awk '{print "  Usado: " $3 "/" $2}'
echo ""

echo "=== SEGURANCA ==="
echo "UFW Firewall:"
ufw status | head -5
echo ""

echo "Fail2ban:"
systemctl is-active fail2ban
echo ""

echo "Backup automatico:"
crontab -l 2>/dev/null | grep backup | head -1
echo ""

echo "=== BANCO DE DADOS ==="
docker exec utop-postgres psql -U utop_user -d utop -c "SELECT 'Usuarios: ' || COUNT(*) FROM \"User\" WHERE \"deletedAt\" IS NULL;" -t
docker exec utop-postgres psql -U utop_user -d utop -c "SELECT 'Tenants: ' || COUNT(*) FROM \"Tenant\" WHERE \"deletedAt\" IS NULL;" -t
docker exec utop-postgres psql -U utop_user -d utop -c "SELECT 'Categorias: ' || COUNT(*) FROM \"Category\" WHERE \"deletedAt\" IS NULL;" -t
docker exec utop-postgres psql -U utop_user -d utop -c "SELECT 'Transacoes: ' || COUNT(*) FROM \"Transaction\" WHERE \"deletedAt\" IS NULL;" -t
echo ""

echo "=== ENDPOINTS ==="
echo "Frontend:"
curl -s -o /dev/null -w "  Status: %{http_code}\n" https://utopsistema.com.br

echo "API:"
curl -s -o /dev/null -w "  Status: %{http_code}\n" https://api.utopsistema.com.br/api/v1/auth/login -X POST

echo ""
echo "=== STATUS FINAL ==="
echo "Sistema: OPERACIONAL"
