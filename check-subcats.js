// Script para verificar subcategorias no banco
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Verificar quantas categorias de cada nível existem
    const byLevel = await prisma.$queryRaw`
      SELECT level, COUNT(*) as count 
      FROM "Category" 
      WHERE "deletedAt" IS NULL 
      GROUP BY level 
      ORDER BY level
    `;
    console.log('Categorias por nível:', byLevel);

    // Verificar se há categorias com parentId preenchido
    const withParent = await prisma.category.count({
      where: { 
        deletedAt: null,
        parentId: { not: null }
      }
    });
    console.log('Categorias com parentId:', withParent);

    // Pegar algumas categorias de nível 1 com seus filhos
    const level1WithChildren = await prisma.category.findMany({
      where: { 
        deletedAt: null, 
        level: 1 
      },
      include: {
        children: {
          where: { deletedAt: null },
          select: { id: true, name: true, level: true }
        }
      },
      take: 5
    });
    
    console.log('\nCategorias nível 1 com filhos:');
    level1WithChildren.forEach(cat => {
      console.log(`- ${cat.name}: ${cat.children.length} filhos`);
      cat.children.forEach(child => {
        console.log(`  - ${child.name} (level ${child.level})`);
      });
    });

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
