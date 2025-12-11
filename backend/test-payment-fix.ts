/**
 * Script para testar correção de pagamento de recorrências
 * Verifica se transações estão sendo criadas e saldos atualizados corretamente
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPaymentFix() {
  try {
    console.log('\n🔍 Verificando transações de recorrências pagas...\n');

    // Buscar últimas transações de recorrências
    const transactions = await prisma.transaction.findMany({
      where: {
        isRecurring: true,
        status: 'completed',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    if (transactions.length === 0) {
      console.log('❌ Nenhuma transação de recorrência encontrada');
    } else {
      console.log(`✅ Encontradas ${transactions.length} transações de recorrências:\n`);

      for (const t of transactions) {
        const signal = t.type === 'expense' ? '-' : '+';
        console.log(`${signal} ${t.description}`);
        console.log(`  Tipo: ${t.type === 'expense' ? 'Despesa' : 'Receita'}`);
        console.log(`  Valor: R$ ${Number(t.amount).toFixed(2)}`);
        console.log(`  Data: ${t.transactionDate.toISOString().split('T')[0]}`);
        console.log(`  Status: ${t.status}\n`);
      }
    }

    // Verificar ocorrências pagas recentemente
    console.log('\n📋 Verificando ocorrências pagas...\n');

    const paidOccurrences = await prisma.recurringBillOccurrence.findMany({
      where: {
        status: 'paid',
      },
      orderBy: {
        paidDate: 'desc',
      },
      take: 10,
    });

    if (paidOccurrences.length === 0) {
      console.log('❌ Nenhuma ocorrência paga encontrada');
    } else {
      console.log(`✅ Encontradas ${paidOccurrences.length} ocorrências pagas:\n`);
      for (const occ of paidOccurrences) {
        console.log(`✓ ID: ${occ.id.substring(0, 8)}...`);
        console.log(`  Vencimento: ${occ.dueDate.toISOString().split('T')[0]}`);
        console.log(`  Pago em: ${occ.paidDate?.toISOString().split('T')[0] || 'N/A'}`);
        console.log(`  Valor: R$ ${Number(occ.paidAmount).toFixed(2)}\n`);
      }
    }

    // Verificar contas bancárias
    console.log('\n💰 Saldos das contas bancárias:\n');

    const accounts = await prisma.bankAccount.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });

    for (const acc of accounts) {
      console.log(`${acc.name}: R$ ${Number(acc.currentBalance).toFixed(2)}`);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPaymentFix();
