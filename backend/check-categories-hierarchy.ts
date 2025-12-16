import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ level: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      type: true,
      level: true,
      icon: true,
      parentId: true,
      parent: { select: { name: true } }
    }
  });
  
  console.log('=== CATEGORIAS DO SISTEMA ===');
  console.log('Total:', categories.length);
  console.log('');
  
  // Agrupar por tipo
  const income = categories.filter(c => c.type === 'income');
  const expense = categories.filter(c => c.type === 'expense');
  
  console.log('--- RECEITAS (' + income.length + ') ---');
  income.forEach(c => {
    const indent = '  '.repeat(c.level - 1);
    const parent = c.parent ? ` (pai: ${c.parent.name})` : '';
    console.log(`${indent}${c.icon} ${c.name} [L${c.level}]${parent}`);
  });
  
  console.log('');
  console.log('--- DESPESAS (' + expense.length + ') ---');
  expense.forEach(c => {
    const indent = '  '.repeat(c.level - 1);
    const parent = c.parent ? ` (pai: ${c.parent.name})` : '';
    console.log(`${indent}${c.icon} ${c.name} [L${c.level}]${parent}`);
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
