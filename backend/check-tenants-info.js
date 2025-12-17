const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const tenants = await p.tenant.findMany({
    select: {
      id: true,
      name: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      createdAt: true,
      _count: {
        select: {
          tenantUsers: true,
          categories: true,
          transactions: true,
          bankAccounts: true,
          recurringBills: true,
          paymentMethods: true,
          budgets: true
        }
      }
    }
  });
  
  console.log('\n📊 INFORMAÇÕES DOS TENANTS\n');
  console.log('='.repeat(80));
  
  for (const t of tenants) {
    console.log(`\n🏢 ${t.name}`);
    console.log(`   ID: ${t.id}`);
    console.log(`   Plano: ${t.subscriptionPlan} | Status: ${t.subscriptionStatus}`);
    console.log(`   Criado em: ${t.createdAt.toLocaleDateString('pt-BR')}`);
    console.log(`   📈 Dados:`);
    console.log(`      - Usuários: ${t._count.tenantUsers}`);
    console.log(`      - Categorias: ${t._count.categories}`);
    console.log(`      - Transações: ${t._count.transactions}`);
    console.log(`      - Contas Bancárias: ${t._count.bankAccounts}`);
    console.log(`      - Contas Recorrentes: ${t._count.recurringBills}`);
    console.log(`      - Meios de Pagamento: ${t._count.paymentMethods}`);
    console.log(`      - Orçamentos: ${t._count.budgets}`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`Total de Tenants: ${tenants.length}\n`);
}

main().finally(() => p.$disconnect());
