const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(ids){
  if (!ids || ids.length === 0) {
    console.error('Usage: node soft-delete-payment-methods.js <id1> <id2> ...');
    process.exit(1);
  }

  console.log('Soft-deleting payment methods:', ids);
  const now = new Date();
  const result = await prisma.paymentMethod.updateMany({
    where: { id: { in: ids } },
    data: { deletedAt: now, isActive: false }
  });

  console.log('Updated count:', result.count);
  await prisma.$disconnect();
}

const ids = process.argv.slice(2);
main(ids).catch(async (e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });