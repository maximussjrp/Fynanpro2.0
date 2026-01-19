const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const profiles = await prisma.userProfile.findMany({
    where: { deletedAt: null },
    include: { 
      tenant: { select: { name: true } }
    },
    orderBy: { name: 'asc' }
  });

  console.log('\n=== PERFIS CADASTRADOS ===\n');
  profiles.forEach(p => {
    console.log(`Tenant: ${p.tenant.name}`);
    console.log(`  Nome: ${p.name}`);
    console.log(`  Documento: ${p.document || 'NÃO INFORMADO'}`);
    console.log(`  Tipo: ${p.documentType}`);
    console.log(`  Padrão: ${p.isDefault ? 'SIM' : 'NÃO'}`);
    console.log('---');
  });
  
  console.log(`\nTotal: ${profiles.length} perfis\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
