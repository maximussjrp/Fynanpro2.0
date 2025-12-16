import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTenantCategories() {
  // O tenant que está sendo usado no login
  const tenantId = '3756a343-9b22-445a-80d1-af4995a7a0f0';
  
  console.log(`🔍 Verificando categorias do tenant ${tenantId.substring(0, 8)}...\n`);
  
  // Buscar categorias deste tenant
  const categories = await prisma.category.findMany({
    where: { tenantId, deletedAt: null },
  });

  console.log(`Total de categorias: ${categories.length}`);
  
  if (categories.length === 0) {
    console.log('\n⚠️ Este tenant não tem categorias! Precisamos criar as categorias padrão.');
    
    // Buscar categorias de um tenant que tenha
    const otherCategories = await prisma.category.findMany({
      where: { deletedAt: null, level: 1 },
      take: 5,
      select: { tenantId: true }
    });
    
    if (otherCategories.length > 0) {
      console.log(`\nTenant com categorias: ${otherCategories[0].tenantId}`);
    }
  } else {
    console.log('\nCategorias L1:');
    const l1 = categories.filter(c => c.level === 1);
    l1.forEach(c => console.log(`  ${c.icon} ${c.name} (${c.type})`));
  }
  
  // Verificar todos os tenants
  console.log('\n📊 Todos os tenants no sistema:');
  const allTenants = await prisma.tenant.findMany({
    select: { id: true, name: true }
  });
  
  for (const t of allTenants) {
    const catCount = await prisma.category.count({
      where: { tenantId: t.id, deletedAt: null }
    });
    console.log(`  ${t.id.substring(0, 8)}... - ${t.name}: ${catCount} categorias`);
  }
}

checkTenantCategories()
  .then(() => prisma.$disconnect())
  .catch(console.error);
