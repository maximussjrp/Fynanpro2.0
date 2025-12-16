import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDoubleEmojiRaw() {
  console.log('🔍 Listando todas as categorias L1 para debug...\n');
  
  // Buscar todas as categorias L1
  const cats = await prisma.category.findMany({
    where: { deletedAt: null, level: 1 },
  });
  
  console.log('Categorias L1 encontradas:');
  for (const cat of cats) {
    const charCodes = [...cat.name].map(c => c.charCodeAt(0)).slice(0, 10);
    console.log(`  ID: ${cat.id.substring(0, 8)}... | Nome: "${cat.name}" | Chars: [${charCodes.join(',')}]`);
  }
  
  // Deletar categorias cujo nome tem mais de um emoji no início
  console.log('\n🔍 Procurando categorias com padrões inválidos...\n');
  
  let totalDeleted = 0;
  
  for (const cat of cats) {
    const name = cat.name;
    // Verificar se o nome tem padrão "X X Y" onde X é o mesmo caractere (emoji duplicado)
    const parts = name.split(' ');
    
    // Se tem 3+ partes e as duas primeiras são iguais, é duplicata
    if (parts.length >= 3 && parts[0] === parts[1]) {
      console.log(`❌ Deletando (split match): "${cat.name}"`);
      await prisma.category.update({
        where: { id: cat.id },
        data: { deletedAt: new Date() }
      });
      totalDeleted++;
      continue;
    }
    
    // Verificar usando regex para emojis compostos (que podem não fazer split)
    // Padrão: emoji + espaço + mesmo emoji + espaço + texto
    const matches = name.match(/^(.+?) (.+?) (.+)$/);
    if (matches && matches[1] === matches[2]) {
      console.log(`❌ Deletando (regex match): "${cat.name}"`);
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

cleanDoubleEmojiRaw()
  .then(() => prisma.$disconnect())
  .catch(console.error);
