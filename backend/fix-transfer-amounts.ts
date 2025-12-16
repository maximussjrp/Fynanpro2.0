import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixTransferAmounts() {
  console.log('🔧 Corrigindo valores de transferências...\n');

  // Buscar todas as transações de transferência
  const transfers = await prisma.transaction.findMany({
    where: {
      type: 'transfer',
      deletedAt: null
    },
    include: {
      bankAccount: true
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  console.log(`📊 Total de transações de transferência: ${transfers.length}\n`);

  // Agrupar por descrição e data (para encontrar pares)
  const grouped = new Map<string, typeof transfers>();
  
  for (const t of transfers) {
    const key = `${t.description}_${t.transactionDate.toISOString().split('T')[0]}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(t);
  }

  let fixedCount = 0;

  for (const [key, pair] of grouped) {
    if (pair.length !== 2) {
      console.log(`⚠️ Par incompleto (${pair.length} transações): ${key}`);
      continue;
    }

    // Identificar origem e destino
    const [t1, t2] = pair;
    
    // A transação de SAÍDA é aquela que tem o destinationAccountId apontando para a outra conta
    let outTransaction: typeof t1;
    let inTransaction: typeof t1;
    
    if (t1.destinationAccountId === t2.bankAccountId) {
      outTransaction = t1;
      inTransaction = t2;
    } else if (t2.destinationAccountId === t1.bankAccountId) {
      outTransaction = t2;
      inTransaction = t1;
    } else {
      console.log(`⚠️ Não foi possível determinar origem/destino para: ${key}`);
      continue;
    }

    const amount = Math.abs(Number(outTransaction.amount));
    
    // Verificar se precisam de correção
    const outNeedsfix = Number(outTransaction.amount) > 0;
    const inNeedsFix = Number(inTransaction.amount) < 0;

    if (outNeedsfix || inNeedsFix) {
      console.log(`\n📝 Corrigindo: ${outTransaction.description}`);
      console.log(`   Conta origem: ${outTransaction.bankAccount?.name} - valor atual: ${outTransaction.amount}`);
      console.log(`   Conta destino: ${inTransaction.bankAccount?.name} - valor atual: ${inTransaction.amount}`);

      // Corrigir transação de saída (deve ser negativo)
      if (outNeedsfix) {
        await prisma.transaction.update({
          where: { id: outTransaction.id },
          data: { amount: -amount }
        });
        console.log(`   ✅ Saída corrigida para: -${amount}`);
      }

      // Corrigir transação de entrada (deve ser positivo)
      if (inNeedsFix) {
        await prisma.transaction.update({
          where: { id: inTransaction.id },
          data: { amount: amount }
        });
        console.log(`   ✅ Entrada corrigida para: ${amount}`);
      }

      fixedCount++;
    }
  }

  console.log(`\n\n✅ Total de pares corrigidos: ${fixedCount}`);
  console.log('🏁 Correção finalizada!');
}

fixTransferAmounts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
