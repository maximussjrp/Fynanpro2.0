const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const count = await prisma.category.count({ 
    where: { tenantId: '5f5465d0-b021-482b-86ae-27ae74b62f8b' } 
  });
  console.log('Categorias criadas para novo tenant:', count);
  
  const l1 = await prisma.category.findMany({
    where: { tenantId: '5f5465d0-b021-482b-86ae-27ae74b62f8b', level: 1 },
    select: { name: true, icon: true }
  });
  console.log('\nL1 categorias:');
  l1.forEach(c => console.log(`  ${c.icon} ${c.name}`));
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
