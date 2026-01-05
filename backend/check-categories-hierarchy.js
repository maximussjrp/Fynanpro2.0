const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  try {
    // Buscar categorias de nível 1 com filhos
    const cats = await p.category.findMany({
      where: { deletedAt: null, level: 1 },
      include: { 
        children: { 
          where: { deletedAt: null },
          include: {
            children: { where: { deletedAt: null } }
          }
        } 
      },
      take: 10
    });
    
    console.log('\n=== CATEGORIAS HIERÁRQUICAS ===\n');
    
    cats.forEach(c => {
      console.log(`📁 ${c.name} (${c.type}) - ${c.children.length} subcategorias`);
      c.children.forEach(child => {
        console.log(`   └── ${child.name} - ${child.children?.length || 0} sub-subcategorias`);
      });
    });
    
    console.log('\n=== RESUMO ===');
    console.log(`Total nível 1: ${cats.length}`);
    console.log(`Com filhos: ${cats.filter(c => c.children.length > 0).length}`);
    
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await p.$disconnect();
  }
}

check();
