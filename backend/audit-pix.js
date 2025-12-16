const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pix = await prisma.paymentMethod.findMany({ 
    where: { type: 'pix' } 
  });
  
  console.log('PIX encontrados:', pix.length);
  pix.forEach(p => console.log(p.id, p.name, p.tenantId));
  
  // Identificar duplicados por tenant
  const byTenant = {};
  pix.forEach(p => {
    if (!byTenant[p.tenantId]) byTenant[p.tenantId] = [];
    byTenant[p.tenantId].push(p);
  });
  
  console.log('\n--- Duplicados por Tenant ---');
  for (const [tenantId, methods] of Object.entries(byTenant)) {
    if (methods.length > 1) {
      console.log(`Tenant ${tenantId}: ${methods.length} PIX duplicados`);
      // Manter apenas o primeiro, deletar os outros
      for (let i = 1; i < methods.length; i++) {
        console.log(`  Deletando: ${methods[i].id} - ${methods[i].name}`);
        await prisma.paymentMethod.delete({ where: { id: methods[i].id } });
      }
    }
  }
  
  console.log('\n✅ Limpeza de PIX duplicados concluída!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
