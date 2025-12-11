const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('=== VERIFICANDO DIA 20 DE DEZEMBRO ===\n');
  
  const tenantId = '3011ab02-0390-4339-91b1-be970d01c3c8';
  
  // Data do dia 20
  const start = new Date('2025-12-20');
  start.setHours(0, 0, 0, 0);
  
  const end = new Date('2025-12-20');
  end.setHours(23, 59, 59, 999);
  
  console.log('Período:', start.toISOString(), 'até', end.toISOString());
  console.log('');
  
  // Buscar transações
  const transactions = await prisma.transaction.findMany({
    where: {
      tenantId,
      transactionDate: {
        gte: start,
        lte: end
      }
    },
    include: {
      category: true,
      bankAccount: true
    }
  });
  
  console.log(`TRANSAÇÕES: ${transactions.length}`);
  transactions.forEach(t => {
    console.log(`  - ${t.description} | R$ ${t.amount} | ${new Date(t.transactionDate).toLocaleString('pt-BR')} | Status: ${t.status}`);
  });
  console.log('');
  
  // Buscar ocorrências
  const occurrences = await prisma.recurringBillOccurrence.findMany({
    where: {
      tenantId,
      dueDate: {
        gte: start,
        lte: end
      }
    },
    include: {
      recurringBill: {
        include: {
          category: true
        }
      }
    }
  });
  
  console.log(`OCORRÊNCIAS: ${occurrences.length}`);
  occurrences.forEach(o => {
    console.log(`  - ${o.recurringBill.name} | R$ ${o.amount} | ${new Date(o.dueDate).toLocaleString('pt-BR')} | Status: ${o.status}`);
  });
  
  console.log('\n=== TOTAL: ', transactions.length + occurrences.length, 'itens ===');
  
  await prisma.$disconnect();
})();
