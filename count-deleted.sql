SELECT COUNT(*) as total, COUNT(CASE WHEN "deletedAt" IS NOT NULL THEN 1 END) as deletados FROM "Transaction";
