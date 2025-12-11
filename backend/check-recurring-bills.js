const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('=== VERIFICANDO RECORRÊNCIAS ===\n');
  
  const bills = await prisma.recurringBill.findMany({
    include: {
      occurrences: {
        orderBy: { dueDate: 'asc' }
      },
      category: true,
      bankAccount: true,
    },
  });

  console.log(`Total de recorrências: ${bills.length}\n`);

  bills.forEach((b, index) => {
    console.log(`[${index + 1}] ${b.name}`);
    console.log(`    ID: ${b.id}`);
    console.log(`    Valor: R$ ${b.amount}`);
    console.log(`    Tipo: ${b.type}`);
    console.log(`    Status: ${b.status}`);
    console.log(`    Dia vencimento: ${b.dueDay}`);
    console.log(`    Auto-gerar: ${b.autoGenerate}`);
    console.log(`    Meses à frente: ${b.monthsAhead}`);
    console.log(`    Categoria: ${b.category?.name || 'N/A'}`);
    console.log(`    Conta: ${b.bankAccount?.name || 'N/A'}`);
    console.log(`    Criado em: ${new Date(b.createdAt).toLocaleString('pt-BR')}`);
    console.log(`    Ocorrências geradas: ${b.occurrences.length}`);
    
    if (b.occurrences.length > 0) {
      console.log('    Ocorrências:');
      b.occurrences.forEach(o => {
        console.log(`      - ${new Date(o.dueDate).toLocaleDateString('pt-BR')} | R$ ${o.amount} | Status: ${o.status}`);
      });
    } else {
      console.log('    ⚠️ NENHUMA OCORRÊNCIA GERADA!');
    }
    console.log('');
  });

  await prisma.$disconnect();
})();
