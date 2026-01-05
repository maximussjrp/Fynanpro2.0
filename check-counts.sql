SELECT 'Users' as table_name, COUNT(*) as count FROM "User"
UNION ALL SELECT 'Tenants', COUNT(*) FROM "Tenant"
UNION ALL SELECT 'Categories', COUNT(*) FROM "Category"
UNION ALL SELECT 'Transactions', COUNT(*) FROM "Transaction";
