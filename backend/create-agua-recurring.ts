import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createNewRecurring() {
  try {
    console.log('\n🔧 CRIANDO NOVA RECORRÊNCIA DE TESTE:\n');

    // Buscar tenant
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      console.log('❌ Tenant não encontrado');
      return;
    }

    // Buscar categoria "Moradia"
    const category = await prisma.category.findFirst({
      where: {
        name: 'Moradia',
        tenantId: tenant.id,
      },
    });

    // Buscar conta "nubank pf"
    const account = await prisma.bankAccount.findFirst({
      where: {
        name: 'nubank pf',
        tenantId: tenant.id,
      },
    });

    if (!category || !account) {
      console.log('❌ Categoria ou conta não encontrada');
      return;
    }

    // Criar recorrência "Água"
    const recurring = await prisma.recurringBill.create({
      data: {
        tenantId: tenant.id,
        name: 'Água',
        amount: 89.90,
        type: 'expense',
        categoryId: category.id,
        bankAccountId: account.id,
        frequency: 'monthly',
        dueDay: 15,
        autoGenerate: true,
        monthsAhead: 3,
        status: 'active',
      },
    });

    console.log('✅ Recorrência "Água" criada com sucesso!');
    console.log(`   ID: ${recurring.id}`);
    console.log(`   Valor: R$ ${recurring.amount}`);
    console.log(`   Vencimento: dia ${recurring.dueDay}`);

    // Gerar 3 ocorrências
    const today = new Date();
    const occurrences = [];

    for (let i = 0; i < 3; i++) {
      const dueDate = new Date(today.getFullYear(), today.getMonth() + i, recurring.dueDay);
      
      const occ = await prisma.recurringBillOccurrence.create({
        data: {
          tenantId: tenant.id,
          recurringBillId: recurring.id,
          dueDate,
          amount: recurring.amount || 0,
          status: 'pending',
        },
      });

      occurrences.push(occ);
      console.log(`✅ Ocorrência criada: ${dueDate.toISOString().split('T')[0]} - R$ ${occ.amount}`);
    }

    console.log(`\n✅ Total: ${occurrences.length} ocorrências criadas!`);
    console.log(`💰 Total a pagar: R$ ${occurrences.reduce((sum, o) => sum + Number(o.amount), 0).toFixed(2)}\n`);

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createNewRecurring();
