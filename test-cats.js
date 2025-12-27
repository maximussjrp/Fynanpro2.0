const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function testNewUserCategories() {
  // Buscar o usuário m2nivel que tem as categorias adicionadas manualmente
  console.log('=== VERIFICANDO CATEGORIAS DO USUARIO M2NIVEL ===');
  
  const tenantUser = await p.tenantUser.findFirst({
    where: { user: { email: 'm2nivel.contato@gmail.com' } },
    select: { tenantId: true }
  });
  
  if (!tenantUser) {
    console.log('Usuario nao encontrado');
    return;
  }
  
  const tenantId = tenantUser.tenantId;
  console.log('TenantId:', tenantId);
  
  // Contar categorias por nível
  const l1 = await p.category.count({ where: { tenantId, level: 1, deletedAt: null } });
  const l2 = await p.category.count({ where: { tenantId, level: 2, deletedAt: null } });
  const l3 = await p.category.count({ where: { tenantId, level: 3, deletedAt: null } });
  
  console.log('Categorias L1:', l1);
  console.log('Categorias L2:', l2);
  console.log('Categorias L3:', l3);
  
  // Listar categorias L1 com filhos
  const catsWithChildren = await p.category.findMany({
    where: { tenantId, level: 1, deletedAt: null },
    include: { children: { where: { deletedAt: null } } },
    take: 10
  });
  
  console.log('\n=== CATEGORIAS COM FILHOS ===');
  catsWithChildren.forEach(c => {
    if (c.children.length > 0) {
      console.log('-', c.name, '| filhos:', c.children.length);
      c.children.slice(0, 3).forEach(child => console.log('  └─', child.name));
    }
  });
}

testNewUserCategories().finally(() => process.exit(0));
