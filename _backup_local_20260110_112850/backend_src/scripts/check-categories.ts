import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCategories() {
  try {
    const total = await prisma.category.count({ 
      where: { deletedAt: null } 
    });
    
    const active = await prisma.category.count({ 
      where: { deletedAt: null, isActive: true } 
    });

    const categories = await prisma.category.findMany({
      where: { deletedAt: null, isActive: true },
      take: 10,
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        icon: true,
        level: true,
        type: true,
        isActive: true,
        parentId: true
      }
    });

    console.log(`\n📊 Categorias no banco:`);
    console.log(`   Total (incluindo inativas): ${total}`);
    console.log(`   Ativas: ${active}\n`);

    console.log(`🔍 Primeiras 10 categorias ativas:`);
    categories.forEach(cat => {
      const indent = '  '.repeat(cat.level - 1);
      console.log(`${indent}${cat.icon} ${cat.name} (Level ${cat.level}, ${cat.type})`);
    });

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCategories();
