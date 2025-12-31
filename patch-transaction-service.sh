#!/bin/bash

# Patch for transaction.service.js to add scheduled filter

docker exec utop-backend bash -c "sed -i '/if (filters.status) {/,/}/c\            if (filters.status) {\n                where.status = filters.status;\n            } else {\n                \/\/ Se não há filtro de status específico, excluir transações \"scheduled\" (templates de recorrentes)\n                where.status = {\n                    not: '\''scheduled'\'',\n                };\n            }' /app/dist/services/transaction.service.js"

echo "Patch applied! Restarting backend..."
docker restart utop-backend
