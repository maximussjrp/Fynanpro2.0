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
    // Verificar se o nome tem emoji duplicado (ex: "🍔 🍔 Alimentação")
    // Padrão: emoji + espaço + mesmo emoji
    const hasDoubleEmoji = /^(.+)\s+\1\s/.test(cat.name);
    
    if (hasDoubleEmoji) {
      console.log(`❌ Deletando categoria com emoji duplicado: "${cat.name}"`);
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
}

cleanDoubleEmojiCategories()
  .then(() => prisma.$disconnect())
  .catch(console.error);
