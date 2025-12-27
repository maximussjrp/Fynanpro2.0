const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Verificar transações de receita
  console.log('=== TRANSAÇÕES DE RECEITA ===');
  const incomeTransactions = await prisma.transaction.findMany({
    where: { type: 'income', deletedAt: null },
    select: {
      id: true,
      description: true,
      amount: true,
      type: true,
      transactionDate: true,
      categoryId: true,
      category: {
        select: { name: true, type: true, level: true }
      }
    },
    take: 20,
    orderBy: { transactionDate: 'desc' }
  });
  
  console.log('Total receitas:', incomeTransactions.length);
  incomeTransactions.forEach(t => {
    console.log(`  ${t.description} | R$ ${t.amount} | Cat: ${t.category?.name || 'SEM CATEGORIA'} | CatType: ${t.category?.type || 'N/A'}`);
  });
  
  // 2. Verificar transações SEM categoria
  console.log('\n=== TRANSAÇÕES SEM CATEGORIA ===');
  const noCategory = await prisma.transaction.findMany({
    where: { categoryId: null, deletedAt: null },
    select: { id: true, description: true, type: true, amount: true },
    take: 20
  });
  console.log('Total sem categoria:', noCategory.length);
  noCategory.forEach(t => {
    console.log(`  ${t.description} | ${t.type} | R$ ${t.amount}`);
  });
  
  // 3. Verificar categorias de receita nível 1
  console.log('\n=== CATEGORIAS DE RECEITA (income) NÍVEL 1 ===');
  const incomeCategories = await prisma.category.findMany({
    where: { type: 'income', level: 1, deletedAt: null },
    select: { id: true, name: true, icon: true, parentId: true }
  });
  console.log('Total categorias income L1:', incomeCategories.length);
  incomeCategories.forEach(c => {
    console.log(`  ${c.icon} ${c.name} | ID: ${c.id}`);
  });
  
  // 4. Contagem geral
  console.log('\n=== CONTAGEM GERAL ===');
  const totalIncome = await prisma.transaction.count({ where: { type: 'income', deletedAt: null } });
  const totalExpense = await prisma.transaction.count({ where: { type: 'expense', deletedAt: null } });
  const totalNoCategory = await prisma.transaction.count({ where: { categoryId: null, deletedAt: null } });
  
  console.log('Total receitas:', totalIncome);
  console.log('Total despesas:', totalExpense);
  console.log('Total sem categoria:', totalNoCategory);
}

main().catch(console.error).finally(() => prisma.$disconnect());
