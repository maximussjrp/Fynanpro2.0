const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const vicios = await prisma.category.findMany({
    where: { 
      OR: [
        { name: { contains: 'cigarro', mode: 'insensitive' } },
        { name: { contains: 'Vicios', mode: 'insensitive' } }
      ]
    },
    select: { id: true, name: true, icon: true, type: true, level: true, parentId: true }
  });
  console.log('Categorias encontradas:');
  console.log(JSON.stringify(vicios, null, 2));
  
  const subcats = await prisma.category.findMany({
    where: { level: { gte: 2 }, isActive: true },
    take: 20,
    select: { id: true, name: true, icon: true, type: true, level: true, parentId: true }
  });
  console.log('\nSubcategorias (L2+):');
  console.log(JSON.stringify(subcats, null, 2));
}

main().finally(() => prisma.$disconnect());