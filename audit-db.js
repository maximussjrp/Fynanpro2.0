const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function audit() {
  console.log('=== AUDITORIA DO BANCO ===');
  
  const users = await p.user.count({ where: { deletedAt: null } });
  console.log('Usuarios ativos:', users);
  
  const tenants = await p.tenant.count({ where: { deletedAt: null } });
  console.log('Tenants ativos:', tenants);
  
  const verified = await p.user.count({ where: { isEmailVerified: true, deletedAt: null } });
  console.log('Emails verificados:', verified);
  
  const cats = await p.category.count({ where: { deletedAt: null } });
  console.log('Categorias totais:', cats);
  
  const catsL1 = await p.category.count({ where: { level: 1, deletedAt: null } });
  const catsL2 = await p.category.count({ where: { level: 2, deletedAt: null } });
  const catsL3 = await p.category.count({ where: { level: 3, deletedAt: null } });
  console.log('Categorias L1:', catsL1, '| L2:', catsL2, '| L3:', catsL3);
  
  const txns = await p.transaction.count({ where: { deletedAt: null } });
  console.log('Transacoes:', txns);
  
  const accounts = await p.bankAccount.count({ where: { deletedAt: null } });
  console.log('Contas bancarias:', accounts);
  
  // Listar usuários
  console.log('\n=== USUARIOS ===');
  const allUsers = await p.user.findMany({ where: { deletedAt: null }, select: { email: true, role: true, isEmailVerified: true } });
  allUsers.forEach(u => console.log('-', u.email, '|', u.role, '| verified:', u.isEmailVerified));
}

audit().finally(() => process.exit(0));
