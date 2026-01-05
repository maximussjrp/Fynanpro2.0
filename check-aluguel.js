const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function restore() {
  // Restaurar RecurringBills deletadas
  const bills = await prisma.recurringBill.updateMany({
    where: { deletedAt: { not: null } },
    data: { deletedAt: null }
  });
  console.log('RecurringBills restauradas:', bills.count);
  
  // Restaurar Occurrences deletadas
  const occs = await prisma.recurringBillOccurrence.updateMany({
    where: { deletedAt: { not: null } },
    data: { deletedAt: null }
  });
  console.log('Occurrences restauradas:', occs.count);
  
  await prisma.$disconnect();
}

restore().catch(console.error);
