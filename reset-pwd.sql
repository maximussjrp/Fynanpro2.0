UPDATE "User" 
SET "passwordHash" = '$2b$12$Go5Wqgw.0pQtQjqEjxcbNeT551rFuIAXrZDe4meQnDPN0jmG9GAoK'
WHERE email = 'xxmaxx05@gmail.com';

SELECT id, email, "fullName" FROM "User" WHERE email = 'xxmaxx05@gmail.com';
