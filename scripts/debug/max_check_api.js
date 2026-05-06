const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const TENANT = 'eb21b270-170b-4c1e-83dc-2b4e49f22341';
const USER = 'b627dea3-cd40-428e-ae2f-ff4da11c5799';

const p = new PrismaClient();
(async () => {
  // count direto Prisma
  const all = await p.category.count({ where: { tenantId: TENANT } });
  const lvl1 = await p.category.count({ where: { tenantId: TENANT, level: 1 } });
  const lvl1Active = await p.category.count({ where: { tenantId: TENANT, level: 1, isActive: true } });
  const lvl1Topless = await p.category.count({ where: { tenantId: TENANT, level: 1, parentId: null } });
  const notDeleted = await p.category.count({ where: { tenantId: TENANT, deletedAt: null } });
  console.log({ all, lvl1, lvl1Active, lvl1Topless, notDeleted });

  const sample = await p.category.findMany({
    where: { tenantId: TENANT, level: 1, parentId: null },
    select: { id: true, name: true, isActive: true, deletedAt: true },
    take: 20,
  });
  console.log('Top-level sample:', sample);
  await p.$disconnect();
})();
