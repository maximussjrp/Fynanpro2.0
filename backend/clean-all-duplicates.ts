import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanAllDuplicates() {
  console.log('🔍 Limpando TODAS as categorias duplicadas...\n');
  
  // Buscar todas as categorias ativas
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ createdAt: 'asc' }],
  });

  // Normalizar nome (remover emojis no início)
  const normalizeName = (name: string): string => {
    // Remove emojis do início do nome e espaços extras
    return name.replace(/^[\p{Emoji}\s]+/gu, '').trim();
  };

  // Agrupar por tenantId + nome normalizado + type + level
  const groups = new Map<string, typeof categories>();
  
  for (const cat of categories) {
    const normalizedName = normalizeName(cat.name);
    const key = `${cat.tenantId}|${normalizedName.toLowerCase()}|${cat.type}|${cat.level}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(cat);
  }

  // Encontrar grupos com duplicatas
  let totalDeleted = 0;
  
  for (const [key, cats] of groups) {
    if (cats.length > 1) {
      // Preferir a categoria com nome mais completo (ex: "Alimentação" vs "🍔 Alimentação")
      // Ordenar: prefere sem emoji no nome, depois pela mais antiga
      cats.sort((a, b) => {
        const aHasEmoji = /^[\p{Emoji}]/u.test(a.name);
        const bHasEmoji = /^[\p{Emoji}]/u.test(b.name);
        if (!aHasEmoji && bHasEmoji) return -1;
        if (aHasEmoji && !bHasEmoji) return 1;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
      
      const [keep, ...toDelete] = cats;
      console.log(`📋 Mantendo: "${keep.name}" (L${keep.level}), deletando ${toDelete.length}:`);
      
      for (const dup of toDelete) {
        console.log(`   ❌ "${dup.name}"`);
        await prisma.category.update({
          where: { id: dup.id },
          data: { deletedAt: new Date() }
        });
        totalDeleted++;
      }
    }
  }

  // Também deletar categorias que têm emoji no nome mas têm equivalente sem emoji
  console.log('\n🔍 Verificando categorias com emoji no nome...\n');
  
  const remainingCats = await prisma.category.findMany({
    where: { deletedAt: null },
  });
  
  for (const cat of remainingCats) {
    if (/^[\p{Emoji}]/u.test(cat.name)) {
      const normalizedName = normalizeName(cat.name);
      
      // Verificar se existe uma versão sem emoji
      const hasCleanVersion = remainingCats.some(c => 
        c.id !== cat.id && 
        c.deletedAt === null &&
        c.tenantId === cat.tenantId &&
        c.type === cat.type &&
        c.level === cat.level &&
        c.name.toLowerCase() === normalizedName.toLowerCase()
      );
      
      if (hasCleanVersion) {
        console.log(`❌ Deletando duplicata com emoji: "${cat.name}"`);
        await prisma.category.update({
          where: { id: cat.id },
          data: { deletedAt: new Date() }
        });
        totalDeleted++;
      }
    }
  }

  console.log(`\n✅ Total de categorias removidas: ${totalDeleted}`);
  
  // Contar categorias restantes
  const remaining = await prisma.category.count({
    where: { deletedAt: null }
  });
  console.log(`📊 Categorias restantes: ${remaining}`);
  
  // Mostrar categorias L1 finais
  console.log('\n📋 Categorias L1 finais:');
  const l1Cats = await prisma.category.findMany({
    where: { deletedAt: null, level: 1 },
    orderBy: [{ type: 'asc' }, { name: 'asc' }]
  });
  
  console.log('\n--- DESPESAS ---');
  l1Cats.filter(c => c.type === 'expense').forEach(c => console.log(`  ${c.icon} ${c.name}`));
  
  console.log('\n--- RECEITAS ---');
  l1Cats.filter(c => c.type === 'income').forEach(c => console.log(`  ${c.icon} ${c.name}`));
}

cleanAllDuplicates()
  .then(() => prisma.$disconnect())
  .catch(console.error);
