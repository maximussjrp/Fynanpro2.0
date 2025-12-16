import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCategoriesByTenant() {
  console.log('🔍 Verificando categorias por tenant...\n');
  
  // Buscar todas as categorias L1 ativas
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, type: true, level: true, tenantId: true, parentId: true }
  });

  // Agrupar por tenant
  const byTenant = new Map<string, typeof categories>();
  
  for (const cat of categories) {
    if (!byTenant.has(cat.tenantId)) {
      byTenant.set(cat.tenantId, []);
    }
    byTenant.get(cat.tenantId)!.push(cat);
  }

  console.log(`Total de tenants: ${byTenant.size}\n`);
  
  for (const [tenantId, cats] of byTenant) {
    const l1 = cats.filter(c => c.level === 1);
    const l2 = cats.filter(c => c.level === 2);
    const l3 = cats.filter(c => c.level === 3);
    
    console.log(`\n📁 Tenant: ${tenantId.substring(0, 8)}...`);
    console.log(`   Total: ${cats.length} (L1: ${l1.length}, L2: ${l2.length}, L3: ${l3.length})`);
    console.log(`   L1 Categorias:`);
    l1.forEach(c => console.log(`     - ${c.name} (${c.type})`));
  }
}

checkCategoriesByTenant()
  .then(() => prisma.$disconnect())
  .catch(console.error);
