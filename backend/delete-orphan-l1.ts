import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteOrphanL1Categories() {
  console.log('🔍 Deletando categorias L1 sem subcategorias (duplicatas órfãs)...\n');
  
  // Buscar todas as categorias L1 ativas
  const l1Cats = await prisma.category.findMany({
    where: { deletedAt: null, level: 1 },
  });

  let totalDeleted = 0;
  
  for (const cat of l1Cats) {
    // Contar subcategorias
    const subsCount = await prisma.category.count({
      where: { deletedAt: null, parentId: cat.id }
    });
    
    if (subsCount === 0) {
      console.log(`❌ Deletando L1 órfã: "${cat.name}" (0 subcategorias)`);
      await prisma.category.update({
        where: { id: cat.id },
        data: { deletedAt: new Date() }
      });
      totalDeleted++;
    }
  }

  console.log(`\n✅ Total de categorias removidas: ${totalDeleted}`);
  
  // Contar categorias restantes
  const remaining = await prisma.category.count({
    where: { deletedAt: null }
  });
  console.log(`📊 Categorias restantes: ${remaining}`);
  
  // Mostrar categorias L1 finais
  console.log('\n📋 Categorias finais (com hierarquia):');
  
  const finalL1 = await prisma.category.findMany({
    where: { deletedAt: null, level: 1 },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    include: {
      children: {
        where: { deletedAt: null },
        include: {
          children: {
            where: { deletedAt: null }
          }
        }
      }
    }
  });
  
  console.log('\n=== DESPESAS ===');
  for (const c of finalL1.filter(c => c.type === 'expense')) {
    console.log(`${c.icon || '?'} ${c.name}`);
    for (const sub of c.children) {
      console.log(`  └─ ${sub.icon || '?'} ${sub.name}`);
      for (const subsub of sub.children) {
        console.log(`      └─ ${subsub.icon || '?'} ${subsub.name}`);
      }
    }
  }
  
  console.log('\n=== RECEITAS ===');
  for (const c of finalL1.filter(c => c.type === 'income')) {
    console.log(`${c.icon || '?'} ${c.name}`);
    for (const sub of c.children) {
      console.log(`  └─ ${sub.icon || '?'} ${sub.name}`);
    }
  }
}

deleteOrphanL1Categories()
  .then(() => prisma.$disconnect())
  .catch(console.error);
