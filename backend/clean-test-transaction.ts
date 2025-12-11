import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanTestTransaction() {
  try {
    // Buscar transação de teste criada em 06/12
    const transactions = await prisma.transaction.findMany({
      where: {
        description: {
          contains: 'Pagamento: Energia',
        },
        transactionDate: {
          gte: new Date('2025-12-06T00:00:00'),
          lt: new Date('2025-12-07T00:00:00'),
        },
      },
      include: {
        bankAccount: true,
      },
    });

    console.log(`\n🔍 Encontradas ${transactions.length} transações de teste:\n`);
    
    for (const tx of transactions) {
      console.log(`ID: ${tx.id}`);
      console.log(`Descrição: ${tx.description}`);
      console.log(`Valor: R$ ${tx.amount}`);
      console.log(`Data: ${tx.transactionDate.toISOString().split('T')[0]}`);
      console.log(`Conta: ${tx.bankAccount?.name}`);
      console.log(`Status: ${tx.status}`);
      
      // Restaurar saldo da conta (se foi debitado)
      if (tx.bankAccountId && tx.status === 'completed') {
        await prisma.bankAccount.update({
          where: { id: tx.bankAccountId },
          data: {
            currentBalance: {
              increment: Number(tx.amount),
            },
          },
        });
        console.log(`✅ Saldo restaurado na conta ${tx.bankAccount?.name}`);
      }
      
      // Deletar transação
      await prisma.transaction.delete({
        where: { id: tx.id },
      });
      console.log(`🗑️ Transação deletada\n`);
    }

    // Resetar ocorrência para pending
    const occurrence = await prisma.recurringBillOccurrence.findFirst({
      where: {
        dueDate: {
          gte: new Date('2025-12-19T00:00:00'),
          lt: new Date('2025-12-20T00:00:00'),
        },
      },
    });

    if (occurrence && occurrence.status === 'paid') {
      await prisma.recurringBillOccurrence.update({
        where: { id: occurrence.id },
        data: {
          status: 'pending',
          paidDate: null,
          paidAmount: null,
        },
      });
      console.log(`✅ Ocorrência 19/12/2025 resetada para 'pending'\n`);
    }

    console.log('✅ Limpeza concluída! Pode testar o pagamento novamente.\n');
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanTestTransaction();
