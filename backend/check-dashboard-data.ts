import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDashboardData() {
  console.log('🔍 Verificando dados para o Dashboard...\n');
  
  // Primeiro, buscar tenant "teste 2.0"
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  console.log('Tenants disponíveis:');
  tenants.forEach(t => console.log(`   - ${t.name} (${t.id})`));
  
  const testeTenant = tenants.find(t => t.name.includes('teste 2.0'));
  if (!testeTenant) {
    console.log('Tenant teste não encontrado!');
    return;
  }
  
  console.log(`\n📌 Usando tenant: ${testeTenant.name} (${testeTenant.id})\n`);
  
  // Período de dezembro 2025
  const startDate = new Date('2025-12-01');
  const endDate = new Date('2025-12-31');
  
  // Todas as transações do período
  const transactions = await prisma.transaction.findMany({
    where: {
      tenantId: testeTenant.id,
      deletedAt: null,
      transactionDate: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      category: true,
      bankAccount: true
    },
    orderBy: { transactionDate: 'asc' }
  });

  console.log(`📊 Total de transações no período: ${transactions.length}\n`);

  // Agrupar por tipo
  const byType = {
    income: transactions.filter(t => t.type === 'income'),
    expense: transactions.filter(t => t.type === 'expense'),
    transfer: transactions.filter(t => t.type === 'transfer')
  };

  console.log('📈 Por tipo:');
  console.log(`   income: ${byType.income.length} transações`);
  console.log(`   expense: ${byType.expense.length} transações`);
  console.log(`   transfer: ${byType.transfer.length} transações`);

  // Valores
  const incomeTotal = byType.income.reduce((sum, t) => sum + Number(t.amount), 0);
  const expenseTotal = byType.expense.reduce((sum, t) => sum + Number(t.amount), 0);
  const transferTotal = byType.transfer.reduce((sum, t) => sum + Number(t.amount), 0);

  console.log('\n💰 Totais:');
  console.log(`   Receitas (income): R$ ${incomeTotal.toFixed(2)}`);
  console.log(`   Despesas (expense): R$ ${expenseTotal.toFixed(2)}`);
  console.log(`   Transferências: R$ ${transferTotal.toFixed(2)}`);
  console.log(`   Saldo (income - expense): R$ ${(incomeTotal - expenseTotal).toFixed(2)}`);

  // Detalhe das transferências
  console.log('\n🔄 Detalhe das transferências:');
  byType.transfer.forEach(t => {
    console.log(`   ${t.description}: R$ ${Number(t.amount).toFixed(2)} (${t.bankAccount?.name})`);
  });

  // Verificar ocorrências pendentes de recorrências
  const pendingOccurrences = await prisma.recurringBillOccurrence.findMany({
    where: {
      tenantId: testeTenant.id,
      dueDate: {
        gte: startDate,
        lte: endDate
      },
      status: 'pending'
    },
    include: {
      recurringBill: {
        select: { name: true, type: true }
      }
    }
  });

  console.log(`\n📅 Ocorrências pendentes de recorrências: ${pendingOccurrences.length}`);
  
  const pendingIncomeOcc = pendingOccurrences
    .filter(o => o.recurringBill?.type === 'income')
    .reduce((sum, o) => sum + Number(o.amount), 0);
  
  const pendingExpenseOcc = pendingOccurrences
    .filter(o => o.recurringBill?.type === 'expense')
    .reduce((sum, o) => sum + Number(o.amount), 0);

  console.log(`   Receitas pendentes (recorrências): R$ ${pendingIncomeOcc.toFixed(2)}`);
  console.log(`   Despesas pendentes (recorrências): R$ ${pendingExpenseOcc.toFixed(2)}`);

  // Qual seria o cálculo correto?
  console.log('\n✅ Cálculo correto para o Dashboard:');
  console.log(`   Receitas = income + pendingIncomeOcc = ${incomeTotal.toFixed(2)} + ${pendingIncomeOcc.toFixed(2)} = ${(incomeTotal + pendingIncomeOcc).toFixed(2)}`);
  console.log(`   Despesas = expense + pendingExpenseOcc = ${expenseTotal.toFixed(2)} + ${pendingExpenseOcc.toFixed(2)} = ${(expenseTotal + pendingExpenseOcc).toFixed(2)}`);
  console.log(`   Transferências NÃO devem afetar o saldo (são neutras)`);

  // Verificar se há transações com type errado (transferências com valores positivos nas duas pontas)
  console.log('\n⚠️ Verificação de integridade:');
  
  // Transações sem categoria
  const semCategoria = transactions.filter(t => !t.category);
  console.log(`   Transações sem categoria: ${semCategoria.length}`);
  semCategoria.forEach(t => {
    console.log(`      - ${t.description}: R$ ${Number(t.amount).toFixed(2)} (type: ${t.type})`);
  });
}

checkDashboardData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
