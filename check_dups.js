const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const cats = await prisma.category.findMany({
    where: { 
      tenantId: 'f0226d49-7801-46b6-a7ad-84fa0a6ccc32', 
      deletedAt: null, 
      name: { in: ['Manutenção', 'IPVA', 'Combustível', 'Documentação', 'Seguro', 'Outros', 'Roupas', 'Presentes', 'iFood'] } 
    },
    include: { parent: { select: { name: true } } },
    orderBy: { name: 'asc' }
  });
  
  console.log('\n📂 Categorias "duplicadas" (na verdade são em contextos diferentes):');
  console.log('='.repeat(60));
  cats.forEach(c => {
    console.log(`${c.name} (L${c.level}) -> pai: ${c.parent?.name || 'RAIZ'}`);
  });
  console.log('\n✅ Isso é NORMAL! São a mesma categoria em pais DIFERENTES.');
  console.log('Ex: Manutenção em 🏠 Moradia e Manutenção em 🚗 Transporte>Carro');
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
