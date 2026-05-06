#!/bin/bash
docker exec utop-postgres psql -U utop_user -d utop -c "SELECT id, name, type, \"deletedAt\" FROM \"Category\" WHERE \"tenantId\"='eb21b270-170b-4c1e-83dc-2b4e49f22341' ORDER BY \"order\";"
docker exec utop-postgres psql -U utop_user -d utop -c "SELECT count(*) AS total_with_deleted FROM \"Category\" WHERE \"tenantId\"='eb21b270-170b-4c1e-83dc-2b4e49f22341';"
