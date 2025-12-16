import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDoubleEmojiCategories() {
  console.log('🔍 Buscando categorias com emoji duplicado no nome...\n');
  
  // Buscar todas as categorias ativas
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
  });

  let totalDeleted = 0;
  
  for (const cat of categories) {
    // Verificar se o nome contém espaço + emoji + espaço (indicativo de emoji duplicado)
    // Exemplos: "🍔 🍔 Alimentação", "🎮 🎮 Lazer"
    const parts = cat.name.split(' ');
    if (parts.length >= 3 && parts[0] === parts[1]) {
      console.log(`❌ Deletando: "${cat.name}" (emoji duplicado detectado)`);
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
  
  // Mostrar categorias restantes
  console.log('\n📋 Categorias L1 restantes:');
  const l1Cats = await prisma.category.findMany({
    where: { deletedAt: null, level: 1 },
    orderBy: { type: 'asc' }
  });
  l1Cats.forEach(c => console.log(`  ${c.type}: ${c.name}`));
}

cleanDoubleEmojiCategories()
  .then(() => prisma.$disconnect())
  .catch(console.error);
