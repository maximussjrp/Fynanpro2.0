import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDuplicateCategories() {
  console.log('🔍 Buscando categorias duplicadas...\n');
  
  // Buscar todas as categorias ativas
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ createdAt: 'asc' }], // Mais antigas primeiro (manter)
  });

  // Agrupar por tenantId + name + type + level
  const groups = new Map<string, typeof categories>();
  
  for (const cat of categories) {
    const key = `${cat.tenantId}|${cat.name}|${cat.type}|${cat.level}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(cat);
  }

  // Encontrar grupos com duplicatas
  let totalDeleted = 0;
  
  for (const [key, cats] of groups) {
    if (cats.length > 1) {
      // Manter a primeira (mais antiga), deletar as outras
      const [keep, ...toDelete] = cats;
      console.log(`📋 "${keep.name}" (${keep.type}, L${keep.level}): mantendo 1, deletando ${toDelete.length}`);
      
      for (const dup of toDelete) {
        await prisma.category.update({
          where: { id: dup.id },
          data: { deletedAt: new Date() }
        });
        totalDeleted++;
      }
    }
  }

  // Também limpar categorias com ícone duplicado ou nome inválido
  console.log('\n🔍 Buscando categorias com ícones duplicados...\n');
  
  const invalidCats = await prisma.category.findMany({
    where: { 
      deletedAt: null,
    }
  });
  
  // Filtrar categorias que têm emoji duplicado no nome
  const nullIconCats = invalidCats.filter(cat => {
    // Verifica se o nome começa com emoji duplicado (emoji + espaço + mesmo emoji)
    const emojiPattern = /^([\p{Emoji}])\s+\1/u;
    return emojiPattern.test(cat.name) || cat.icon === null || cat.icon === '';
  });

  for (const cat of nullIconCats) {
    console.log(`❌ Deletando categoria inválida: "${cat.name}" (icon: ${cat.icon})`);
    await prisma.category.update({
      where: { id: cat.id },
      data: { deletedAt: new Date() }
    });
    totalDeleted++;
  }

  console.log(`\n✅ Total de categorias removidas: ${totalDeleted}`);
  
  // Contar categorias restantes
  const remaining = await prisma.category.count({
    where: { deletedAt: null }
  });
  console.log(`📊 Categorias restantes: ${remaining}`);
}

cleanDuplicateCategories()
  .then(() => prisma.$disconnect())
  .catch(console.error);
