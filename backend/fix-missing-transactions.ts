/**
 * Script para corrigir pagamentos antigos que não geraram transações
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMissingTransactions() {
  try {
    console.log('\n🔧 Corrigindo pagamentos sem transações...\n');

    // Buscar ocorrências pagas que não têm transação correspondente
    const paidOccurrences = await prisma.recurringBillOccurrence.findMany({
      where: {
        status: 'paid',
        paidDate: { not: null },
      },
      include: {
        recurringBill: {
          include: {
            bankAccount: true,
            category: true,
          },
        },
      },
      orderBy: {
        paidDate: 'desc',
      },
    });

    console.log(`📋 Encontradas ${paidOccurrences.length} ocorrências pagas\n`);

    let fixed = 0;
    let alreadyHasTransaction = 0;
    let errors = 0;

    for (const occ of paidOccurrences) {
      try {
        const bill = occ.recurringBill;

        // Verificar se já existe transação para esta ocorrência
        const existingTransaction = await prisma.transaction.findFirst({
          where: {
            isRecurring: true,
            recurringBillId: bill.id,
            transactionDate: occ.dueDate,
            amount: occ.paidAmount || 0,
          },
        });

        if (existingTransaction) {
          alreadyHasTransaction++;
          console.log(`✓ Já existe: ${bill.name} (${occ.dueDate.toISOString().split('T')[0]})`);
          continue;
        }

        // Verificar se tem dados necessários
        if (!bill.bankAccountId || !bill.categoryId) {
          console.log(`⚠️  Pulado: ${bill.name} - sem conta ou categoria`);
          errors++;
          continue;
        }

        // Criar transação
        const actualPaymentDate = occ.paidDate!;
        const dueDate = occ.dueDate;

        const diffTime = actualPaymentDate.getTime() - dueDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        const isPaidEarly = diffDays < 0;
        const isPaidLate = diffDays > 0;
        const daysEarlyLate = Math.abs(diffDays);

        // Buscar owner do tenant
        const tenantUser = await prisma.tenantUser.findFirst({
          where: { 
            tenantId: bill.tenantId,
            role: 'owner',
          },
        });

        if (!tenantUser) {
          console.log(`⚠️  Pulado: ${bill.name} - sem usuário owner no tenant`);
          errors++;
          continue;
        }

        await prisma.transaction.create({
          data: {
            tenantId: bill.tenantId,
            userId: tenantUser.userId,
            type: bill.type,
            categoryId: bill.categoryId,
            bankAccountId: bill.bankAccountId,
            paymentMethodId: bill.paymentMethodId,
            amount: occ.paidAmount || 0,
            description: `Pagamento: ${bill.name}`,
            transactionDate: dueDate,
            paidDate: actualPaymentDate,
            isPaidEarly,
            isPaidLate,
            daysEarlyLate: diffDays !== 0 ? daysEarlyLate : null,
            status: 'completed',
            isRecurring: true,
            recurringBillId: bill.id,
          },
        });

        // Atualizar saldo da conta (aplicar a mudança corretamente)
        const balanceChange = Number(occ.paidAmount);
        if (bill.type === 'expense') {
          await prisma.bankAccount.update({
            where: { id: bill.bankAccountId },
            data: { currentBalance: { decrement: balanceChange } },
          });
        } else {
          await prisma.bankAccount.update({
            where: { id: bill.bankAccountId },
            data: { currentBalance: { increment: balanceChange } },
          });
        }

        fixed++;
        const signal = bill.type === 'expense' ? '-' : '+';
        console.log(`✅ Corrigido: ${bill.name} (${dueDate.toISOString().split('T')[0]}) ${signal}R$ ${balanceChange.toFixed(2)}`);

      } catch (error) {
        console.error(`❌ Erro ao processar ocorrência ${occ.id}:`, error);
        errors++;
      }
    }

    console.log('\n📊 Resumo:');
    console.log(`  ✅ Corrigidos: ${fixed}`);
    console.log(`  ℹ️  Já tinham transação: ${alreadyHasTransaction}`);
    console.log(`  ❌ Erros: ${errors}`);

    // Mostrar saldo atualizado
    console.log('\n💰 Saldos atualizados:\n');
    const accounts = await prisma.bankAccount.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });

    for (const acc of accounts) {
      console.log(`${acc.name}: R$ ${Number(acc.currentBalance).toFixed(2)}`);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMissingTransactions();
