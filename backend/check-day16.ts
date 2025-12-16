import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDay16() {
  console.log('🔍 Verificando transações do dia 16/12...\n');
  
  const tenantId = '066266a7-6871-4619-bf14-5ab358d9e98a';
  
  // Transações do dia 16
  const transactions = await prisma.transaction.findMany({
    where: {
      tenantId,
      deletedAt: null,
      transactionDate: {
        gte: new Date('2025-12-16'),
        lte: new Date('2025-12-16T23:59:59')
      }
    },
    select: {
      id: true,
      description: true,
      amount: true,
      type: true,
      status: true
    }
  });

  console.log(`Transações encontradas: ${transactions.length}`);
  transactions.forEach(t => {
    console.log(`  - ${t.description}: R$ ${Number(t.amount).toFixed(2)} (${t.type}, ${t.status})`);
  });

  // Ocorrências de recorrência do dia 16
  const occurrences = await prisma.recurringBillOccurrence.findMany({
    where: {
      tenantId,
      dueDate: {
        gte: new Date('2025-12-16'),
        lte: new Date('2025-12-16T23:59:59')
      }
    },
    include: {
      recurringBill: { select: { name: true, type: true } }
    }
  });

  console.log(`\nOcorrências de recorrência: ${occurrences.length}`);
  occurrences.forEach(o => {
    console.log(`  - ${o.recurringBill?.name}: R$ ${Number(o.amount).toFixed(2)} (${o.status})`);
  });
}

checkDay16()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
