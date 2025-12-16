import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function consolidateCategories() {
  console.log('🔍 Consolidando categorias duplicadas...\n');
  
  // Buscar todas as categorias ativas
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ createdAt: 'asc' }],
  });

  // Extrair o nome base (sem emoji no início)
  const getBaseName = (name: string): string => {
    // Se começa com emoji (high surrogate), pular emoji e espaço
    if (name.charCodeAt(0) >= 55296 && name.charCodeAt(0) <= 56319) {
      // Encontrar o primeiro espaço e pegar o resto
      const spaceIdx = name.indexOf(' ');
      if (spaceIdx !== -1) {
        return name.substring(spaceIdx + 1).trim();
      }
    }
    return name.trim();
  };

  // Agrupar por tenantId + nome base + type + level
  const groups = new Map<string, typeof categories>();
  
  for (const cat of categories) {
    const baseName = getBaseName(cat.name).toLowerCase();
    const key = `${cat.tenantId}|${baseName}|${cat.type}|${cat.level}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(cat);
  }

  // Encontrar grupos com duplicatas
  let totalDeleted = 0;
  
  for (const [key, cats] of groups) {
    if (cats.length > 1) {
      // Preferir categoria com nome mais completo (com & ou sem emoji no nome)
      cats.sort((a, b) => {
        // Preferir nomes com "&" (ex: "Lazer & Entretenimento" > "Lazer")
        const aHasAmp = a.name.includes('&');
        const bHasAmp = b.name.includes('&');
        if (aHasAmp && !bHasAmp) return -1;
        if (!aHasAmp && bHasAmp) return 1;
        
        // Preferir nomes sem emoji
        const aStartsEmoji = a.name.charCodeAt(0) >= 55296;
        const bStartsEmoji = b.name.charCodeAt(0) >= 55296;
        if (!aStartsEmoji && bStartsEmoji) return -1;
        if (aStartsEmoji && !bStartsEmoji) return 1;
        
        // Preferir mais antigo
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
      
      const [keep, ...toDelete] = cats;
      console.log(`📋 Mantendo: "${keep.name}", deletando ${toDelete.length}:`);
      
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

  console.log(`\n✅ Total de categorias removidas: ${totalDeleted}`);
  
  // Contar categorias restantes
  const remaining = await prisma.category.count({
    where: { deletedAt: null }
  });
  console.log(`📊 Categorias restantes: ${remaining}`);
  
  // Mostrar categorias L1 finais
  console.log('\n📋 Categorias finais (L1 apenas):');
  const l1Cats = await prisma.category.findMany({
    where: { deletedAt: null, level: 1 },
    orderBy: [{ type: 'asc' }, { name: 'asc' }]
  });
  
  console.log('\n--- DESPESAS ---');
  for (const c of l1Cats.filter(c => c.type === 'expense')) {
    const subs = await prisma.category.count({
      where: { deletedAt: null, parentId: c.id }
    });
    console.log(`  ${c.icon || '?'} ${c.name} (${subs} subcategorias)`);
  }
  
  console.log('\n--- RECEITAS ---');
  for (const c of l1Cats.filter(c => c.type === 'income')) {
    const subs = await prisma.category.count({
      where: { deletedAt: null, parentId: c.id }
    });
    console.log(`  ${c.icon || '?'} ${c.name} (${subs} subcategorias)`);
  }
}

consolidateCategories()
  .then(() => prisma.$disconnect())
  .catch(console.error);
