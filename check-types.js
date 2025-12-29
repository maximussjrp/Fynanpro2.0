const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Agrupar por transactionType
  const byType = await prisma.transaction.groupBy({
    by: ['transactionType'],
    _count: true,
    where: { deletedAt: null }
  });
  console.log('Por tipo de transação:');
  console.log(JSON.stringify(byType, null, 2));
  
  // Buscar transações que têm totalInstallments (parceladas)
  const installments = await prisma.transaction.findMany({
    where: { 
      deletedAt: null,
      totalInstallments: { not: null }
    },
    select: {
      id: true,
      description: true,
      transactionType: true,
      totalInstallments: true,
      installmentNumber: true,
      isRecurring: true,
      frequency: true
    },
    take: 10
  });
  console.log('\nTransações com parcelas:');
  console.log(JSON.stringify(installments, null, 2));
  
  // Buscar transações recorrentes
  const recurring = await prisma.transaction.findMany({
    where: { 
      deletedAt: null,
      transactionType: 'recurring'
    },
    select: {
      id: true,
      description: true,
      transactionType: true,
      isRecurring: true,
      frequency: true
    },
    take: 10
  });
  console.log('\nTransações recorrentes:');
  console.log(JSON.stringify(recurring, null, 2));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
