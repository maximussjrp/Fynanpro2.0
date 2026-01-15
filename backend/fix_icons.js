const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mapeamento de emojis para cores
const emojiColors = {
  '💵': '#22C55E', // Verde - Receitas
  '🏠': '#F59E0B', // Laranja - Moradia
  '🍔': '#EF4444', // Vermelho - Alimentação
  '🏥': '#EC4899', // Rosa - Saúde
  '💰': '#DC2626', // Vermelho escuro - Dívidas
  '🏛️': '#6B7280', // Cinza - Impostos
  '🚗': '#3B82F6', // Azul - Transporte
  '💼': '#8B5CF6', // Roxo - Trabalho
  '🎓': '#10B981', // Verde esmeralda - Educação
  '👨‍👩‍👧': '#F97316', // Laranja escuro - Família
  '💅': '#DB2777', // Pink - Beleza
  '👕': '#6366F1', // Indigo - Vestuário
  '🎮': '#14B8A6', // Teal - Lazer
  '🚬': '#991B1B', // Vermelho muito escuro - Vícios
  '💸': '#FBBF24', // Amarelo - Impulso
  '📈': '#059669', // Verde escuro - Investimentos
  '🎯': '#7C3AED', // Violeta - Metas
};

// Função para extrair emoji do início da string
function extractEmoji(str) {
  const emojiRegex = /^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|👨‍👩‍👧)/u;
  const match = str.match(emojiRegex);
  return match ? match[0] : null;
}

async function fixIcons() {
  console.log('🔧 Corrigindo campos icon e color das categorias...\n');
  
  // Buscar todas as categorias ativas de todos os tenants
  const categories = await prisma.category.findMany({
    where: { deletedAt: null }
  });
  
  console.log(`📋 Total de categorias: ${categories.length}\n`);
  
  let updated = 0;
  let l1Updated = 0;
  
  for (const cat of categories) {
    let icon = cat.icon;
    let color = cat.color;
    let needsUpdate = false;
    
    if (cat.level === 1) {
      // L1: Extrair emoji do nome
      const emoji = extractEmoji(cat.name);
      if (emoji && (!icon || icon === 'NULL')) {
        icon = emoji;
        needsUpdate = true;
      }
      
      // Definir cor baseada no emoji
      if (emoji && emojiColors[emoji] && (!color || color === 'NULL')) {
        color = emojiColors[emoji];
        needsUpdate = true;
      } else if (!color || color === 'NULL') {
        color = '#3B82F6'; // Azul padrão
        needsUpdate = true;
      }
      
      if (needsUpdate) l1Updated++;
    } else {
      // L2 e L3: Herdar do pai ou usar padrão
      if (!icon || icon === 'NULL') {
        icon = '📝';
        needsUpdate = true;
      }
      if (!color || color === 'NULL') {
        color = '#6B7280'; // Cinza para subcategorias
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
      await prisma.category.update({
        where: { id: cat.id },
        data: { icon, color }
      });
      updated++;
    }
  }
  
  console.log(`✅ Atualizadas: ${updated} categorias`);
  console.log(`   L1 com emoji corrigido: ${l1Updated}`);
  
  // Verificação final
  console.log('\n📊 VERIFICAÇÃO FINAL (L1):');
  const l1Cats = await prisma.category.findMany({
    where: { level: 1, deletedAt: null },
    take: 17,
    distinct: ['name'],
    select: { name: true, icon: true, color: true }
  });
  
  l1Cats.forEach(c => {
    console.log(`   ${c.icon} ${c.name} - ${c.color}`);
  });
}

fixIcons()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
