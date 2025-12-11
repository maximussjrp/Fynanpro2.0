import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOccurrences() {
  try {
    console.log('\n📋 VERIFICANDO OCORRÊNCIAS APÓS PAGAMENTO:\n');

    // Buscar todas as ocorrências de "Energia"
    const bill = await prisma.recurringBill.findFirst({
      where: {
        name: 'Energia',
      },
    });

    if (!bill) {
      console.log('❌ Recorrência "Energia" não encontrada');
      return;
    }

    const occurrences = await prisma.recurringBillOccurrence.findMany({
      where: {
        recurringBillId: bill.id,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    console.log(`🔍 Total de ocorrências: ${occurrences.length}\n`);

    occurrences.forEach((occ, index) => {
      console.log(`${index + 1}. ID: ${occ.id}`);
      console.log(`   Vencimento: ${occ.dueDate.toISOString().split('T')[0]}`);
      console.log(`   Status: ${occ.status}`);
      console.log(`   Valor: R$ ${occ.amount}`);
      if (occ.paidDate) {
        console.log(`   Pago em: ${occ.paidDate.toISOString().split('T')[0]}`);
      }
      console.log('');
    });

    // Buscar transação criada
    const transaction = await prisma.transaction.findFirst({
      where: {
        recurringBillId: bill.id,
        status: 'completed',
      },
    });

    if (transaction) {
      console.log('💳 TRANSAÇÃO CRIADA:');
      console.log(`   ID: ${transaction.id}`);
      console.log(`   Descrição: ${transaction.description}`);
      console.log(`   Data transação: ${transaction.transactionDate.toISOString().split('T')[0]}`);
      console.log(`   Pago em: ${transaction.paidDate?.toISOString().split('T')[0] || 'N/A'}`);
      console.log(`   Status: ${transaction.status}`);
      console.log(`   Antecipado: ${transaction.isPaidEarly}`);
      console.log(`   Atrasado: ${transaction.isPaidLate}`);
      console.log(`   Dias: ${transaction.daysEarlyLate}`);
    }

    console.log('\n✅ Verificação concluída!\n');
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOccurrences();
