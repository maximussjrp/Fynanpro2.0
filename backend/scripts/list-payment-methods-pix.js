const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const methods = await prisma.paymentMethod.findMany({
    where: {
      deletedAt: null,
      name: {
        contains: 'pix',
        mode: 'insensitive'
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log('Found', methods.length, 'payment methods matching "pix":');
  methods.forEach(m => {
    console.log({ id: m.id, name: m.name, tenantId: m.tenantId, type: m.type, createdAt: m.createdAt });
  });

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});