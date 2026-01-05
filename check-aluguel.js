const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const transactions = await prisma.transaction.findMany({
    where: { 
      description: { contains: 'aluguel', mode: 'insensitive' }
    },
    select: { 
      id: true, 
      description: true, 
      parentId: true, 
      status: true 
    }
  });
  
  console.log('Transações com aluguel:');
  console.log(JSON.stringify(transactions, null, 2));
  
  // Verificar RecurringBillOccurrences também
  const occurrences = await prisma.recurringBillOccurrence.findMany({
    where: {
      recurringBill: {
        name: { contains: 'aluguel', mode: 'insensitive' }
      }
    },
    include: {
      recurringBill: { select: { id: true, name: true } }
    }
  });
  console.log('\nRecurringBillOccurrences com aluguel:');
  console.log(JSON.stringify(occurrences, null, 2));
  
  await prisma.$disconnect();
}

check().catch(console.error);
