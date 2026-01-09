const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.findMany({
    where: { level: 1, isActive: true },
    take: 10,
    select: { name: true, icon: true, type: true, level: true }
  });
  console.log('Categorias L1:');
  console.log(JSON.stringify(categories, null, 2));
}

main().finally(() => prisma.$disconnect());
