import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function forceGenerateMarch() {
  try {
    console.log('\n🔧 FORÇANDO GERAÇÃO DA OCORRÊNCIA DE MARÇO/2026:\n');

    // Buscar recurring bill "Energia"
    const bill = await prisma.recurringBill.findFirst({
      where: {
        name: 'Energia',
      },
    });

    if (!bill) {
      console.log('❌ Recorrência "Energia" não encontrada');
      return;
    }

    // Verificar se já existe março
    const marchExists = await prisma.recurringBillOccurrence.findFirst({
      where: {
        recurringBillId: bill.id,
        dueDate: {
          gte: new Date('2026-03-01'),
          lt: new Date('2026-04-01'),
        },
      },
    });

    if (marchExists) {
      console.log('✅ Ocorrência de março já existe!');
      console.log(`   Vencimento: ${marchExists.dueDate.toISOString().split('T')[0]}`);
      console.log(`   Status: ${marchExists.status}`);
      return;
    }

    // Criar ocorrência de março
    const marchOccurrence = await prisma.recurringBillOccurrence.create({
      data: {
        tenantId: bill.tenantId,
        recurringBillId: bill.id,
        dueDate: new Date('2026-03-20'),
        amount: bill.amount || 119,
        status: 'pending',
      },
    });

    console.log('✅ Ocorrência de março criada com sucesso!');
    console.log(`   ID: ${marchOccurrence.id}`);
    console.log(`   Vencimento: ${marchOccurrence.dueDate.toISOString().split('T')[0]}`);
    console.log(`   Valor: R$ ${marchOccurrence.amount}`);
    console.log(`   Status: ${marchOccurrence.status}`);

    // Listar todas as ocorrências
    const all = await prisma.recurringBillOccurrence.findMany({
      where: {
        recurringBillId: bill.id,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    console.log('\n📋 TODAS AS OCORRÊNCIAS:');
    all.forEach((occ, index) => {
      console.log(`${index + 1}. ${occ.dueDate.toISOString().split('T')[0]} - ${occ.status}`);
    });

    console.log('\n✅ Concluído! Agora você tem 3 pendentes (jan/fev/mar) + 1 paga (dez)\n');
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

forceGenerateMarch();
