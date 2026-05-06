#!/bin/bash
P='docker exec utop-postgres psql -U utop_user -d utop'
echo "=== Todos tenants do Max ==="
$P -c "SELECT t.id, t.name, t.slug, tu.role, t.\"deletedAt\" FROM \"Tenant\" t JOIN \"TenantUser\" tu ON tu.\"tenantId\"=t.id WHERE tu.\"userId\"='b627dea3-cd40-428e-ae2f-ff4da11c5799';"
echo ""
echo "=== Categorias por tenant (Max) ==="
$P -c "SELECT \"tenantId\", count(*) FROM \"Category\" WHERE \"tenantId\" IN (SELECT \"tenantId\" FROM \"TenantUser\" WHERE \"userId\"='b627dea3-cd40-428e-ae2f-ff4da11c5799') GROUP BY \"tenantId\";"
