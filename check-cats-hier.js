const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Verificar estrutura hierárquica
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    select: {
      name: true,
      type: true,
      level: true,
      parentId: true
    },
    orderBy: [{ type: 'asc' }, { level: 'asc' }, { name: 'asc' }],
    take: 30
  });
  
  console.log('=== CATEGORIAS ===');
  console.log(JSON.stringify(categories, null, 2));
  
  // Verificar categorias com filhos
  const parents = await prisma.category.findMany({
    where: { 
      deletedAt: null,
      children: { some: { deletedAt: null } }
    },
    select: {
      name: true,
      type: true,
      level: true,
      _count: { select: { children: true } }
    }
  });
  
  console.log('\n=== CATEGORIAS PAI (com filhos) ===');
  console.log(JSON.stringify(parents, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
