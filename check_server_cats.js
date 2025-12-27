const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // Verificar tenant xmax teste
  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'xmax' } }
  });
  
  console.log('\n📋 Tenant:', tenant.name, tenant.id);
  
  // Buscar TODAS as categorias (incluindo deletadas)
  const allCats = await prisma.category.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ level: 'asc' }, { name: 'asc' }]
  });
  
  const active = allCats.filter(c => !c.deletedAt);
  const deleted = allCats.filter(c => c.deletedAt);
  
  console.log(`\n📊 Total: ${allCats.length} | Ativas: ${active.length} | Deletadas: ${deleted.length}`);
  
  // Mostrar L1 ativas
  console.log('\n🏷️  CATEGORIAS L1 ATIVAS:');
  const l1 = active.filter(c => c.level === 1);
  l1.forEach(c => {
    const subs = active.filter(s => s.parentId === c.id).length;
    console.log(`   ${c.name} (${subs} sub) - type: ${c.type}`);
  });
  
  // Verificar se tem categorias sem emoji
  console.log('\n⚠️  L1 SEM EMOJI:');
  l1.filter(c => !c.name.match(/[\u{1F300}-\u{1F9FF}]/u)).forEach(c => {
    console.log(`   ${c.name}`);
  });
  
  // Verificar frontend query
  console.log('\n🔍 Query do frontend (deletedAt IS NULL):');
  const frontendCats = await prisma.category.findMany({
    where: { tenantId: tenant.id, deletedAt: null, level: 1 },
    orderBy: { name: 'asc' }
  });
  console.log(`   Retorna ${frontendCats.length} categorias L1`);
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
