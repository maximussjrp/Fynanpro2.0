const { PrismaClient } = require('@prisma/client');
const { createDefaultCategories } = require('./dist/utils/default-categories');

const TENANT = 'eb21b270-170b-4c1e-83dc-2b4e49f22341';
const p = new PrismaClient();

(async () => {
  await createDefaultCategories(TENANT);
  const total = await p.category.count({ where: { tenantId: TENANT } });
  const top = await p.category.findMany({
    where: { tenantId: TENANT, level: 1 },
    select: { name: true, type: true },
    orderBy: { name: 'asc' },
  });
  console.log('Total categorias:', total);
  console.log('Top-level:', top);
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
