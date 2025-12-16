import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixEnviadaTransactions() {
  console.log('🔍 Buscando transações "enviada" que estão como income...\n');
  
  const tenantId = '066266a7-6871-4619-bf14-5ab358d9e98a';
  
  // Buscar transações com "enviada" no nome que estão como income (deveria ser expense)
  const wrongEnviadas = await prisma.transaction.findMany({
    where: {
      tenantId,
      deletedAt: null,
      description: { contains: 'enviada', mode: 'insensitive' },
      type: 'income'
    },
    select: {
      id: true,
      description: true,
      amount: true,
      type: true
    }
  });

  console.log(`Transações "enviada" erradas (income → expense): ${wrongEnviadas.length}`);
  wrongEnviadas.forEach(t => {
    console.log(`  - ${(t.description || '').substring(0, 50)}... | R$ ${Number(t.amount).toFixed(2)} | ${t.type}`);
  });

  // Buscar transações com "recebida" no nome que estão como expense (deveria ser income)
  const wrongRecebidas = await prisma.transaction.findMany({
    where: {
      tenantId,
      deletedAt: null,
      description: { contains: 'recebida', mode: 'insensitive' },
      type: 'expense'
    },
    select: {
      id: true,
      description: true,
      amount: true,
      type: true
    }
  });

  console.log(`\nTransações "recebida" erradas (expense → income): ${wrongRecebidas.length}`);
  wrongRecebidas.forEach(t => {
    console.log(`  - ${(t.description || '').substring(0, 50)}... | R$ ${Number(t.amount).toFixed(2)} | ${t.type}`);
  });

  // Corrigir as transações
  if (wrongEnviadas.length > 0) {
    console.log('\n🔧 Corrigindo transações "enviada"...');
    for (const t of wrongEnviadas) {
      await prisma.transaction.update({
        where: { id: t.id },
        data: { type: 'expense' }
      });
      console.log(`  ✅ ${t.id} → expense`);
    }
  }

  if (wrongRecebidas.length > 0) {
    console.log('\n🔧 Corrigindo transações "recebida"...');
    for (const t of wrongRecebidas) {
      await prisma.transaction.update({
        where: { id: t.id },
        data: { type: 'income' }
      });
      console.log(`  ✅ ${t.id} → income`);
    }
  }

  console.log('\n✅ Correção concluída!');
}

fixEnviadaTransactions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
