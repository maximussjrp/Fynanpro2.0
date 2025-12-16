import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDoubleEmojiByContains() {
  console.log('🔍 Buscando categorias com emoji duplicado...\n');
  
  // Lista de padrões com emoji duplicado
  const doubleEmojiPatterns = [
    '🍔 🍔', '🎮 🎮', '🏠 🏠', '🏥 🏥', '💼 💼', 
    '💳 💳', '📚 📚', '🚗 🚗', '🐕 🐕', '👕 👕',
    '🏋️ 🏋️', '🎁 🎁', '💰 💰', '💵 💵'
  ];
  
  let totalDeleted = 0;
  
  for (const pattern of doubleEmojiPatterns) {
    const cats = await prisma.category.findMany({
      where: { 
        deletedAt: null,
        name: { contains: pattern }
      }
    });
    
    for (const cat of cats) {
      console.log(`❌ Deletando: "${cat.name}"`);
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

cleanDoubleEmojiByContains()
  .then(() => prisma.$disconnect())
  .catch(console.error);
