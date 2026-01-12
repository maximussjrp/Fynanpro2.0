import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpando templates existentes...\n');

  const deleted = await prisma.recurringBill.deleteMany({
    where: { isTemplate: true },
  });

  console.log(`✅ ${deleted.count} templates removidos\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
