const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Verificar transações de receita (income)
  const receitas = await prisma.transaction.findMany({
    where: { type: 'income', deletedAt: null },
    select: { 
      id: true, 
      description: true, 
      amount: true, 
      categoryId: true, 
      transactionDate: true,
      category: { select: { name: true, type: true } }
    },
    take: 20
  });
  console.log('=== RECEITAS (income) ===');
  console.log('Total encontradas:', receitas.length);
  receitas.forEach(r => {
    console.log(`- ${r.description}: R$ ${r.amount} | Cat: ${r.category?.name || 'SEM CATEGORIA'} | ${r.transactionDate}`);
  });

  // 2. Verificar transações de despesa (expense)
  const despesas = await prisma.transaction.findMany({
    where: { type: 'expense', deletedAt: null },
    select: { 
      id: true, 
      description: true, 
      amount: true, 
      categoryId: true,
      category: { select: { name: true, type: true } }
    },
    take: 10
  });
  console.log('\n=== DESPESAS (expense) ===');
  console.log('Total encontradas:', despesas.length);
  despesas.forEach(d => {
    console.log(`- ${d.description}: R$ ${d.amount} | Cat: ${d.category?.name || 'SEM CATEGORIA'}`);
  });

  // 3. Verificar se há transações SEM categoryId
  const semCategoria = await prisma.transaction.count({
    where: { categoryId: null, deletedAt: null }
  });
  console.log('\n=== TRANSAÇÕES SEM CATEGORIA ===');
  console.log('Total:', semCategoria);

  // 4. Verificar categorias de receita
  const catsReceita = await prisma.category.findMany({
    where: { type: 'income', deletedAt: null, level: 1 },
    select: { id: true, name: true, icon: true }
  });
  console.log('\n=== CATEGORIAS DE RECEITA (L1) ===');
  catsReceita.forEach(c => console.log(`- ${c.icon} ${c.name} (${c.id})`));

  // 5. Verificar transações por mês/ano em 2025
  const porMes = await prisma.$queryRaw`
    SELECT 
      EXTRACT(MONTH FROM "transactionDate") as mes,
      type,
      COUNT(*) as count,
      SUM(amount) as total
    FROM "Transaction"
    WHERE "deletedAt" IS NULL 
      AND EXTRACT(YEAR FROM "transactionDate") = 2025
    GROUP BY EXTRACT(MONTH FROM "transactionDate"), type
    ORDER BY mes, type
  `;
  console.log('\n=== TRANSAÇÕES 2025 POR MÊS ===');
  console.log(JSON.stringify(porMes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
