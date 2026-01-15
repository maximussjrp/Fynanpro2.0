const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const cats = await prisma.category.findMany({
    where: { level: 1, deletedAt: null },
    take: 10,
    select: { name: true, icon: true, color: true }
  });
  
  console.log('\n📋 Verificando campos icon e color das categorias L1:');
  cats.forEach(c => {
    console.log(`Name: ${c.name} | Icon: ${c.icon || 'NULL'} | Color: ${c.color || 'NULL'}`);
  });
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
