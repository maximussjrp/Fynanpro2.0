const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('=== REGENERANDO OCORRÊNCIAS DA ÁGUA ===\n');
  
  // Buscar a recorrência Água
  const agua = await prisma.recurringBill.findFirst({
    where: { name: 'Agua' }
  });

  if (!agua) {
    console.log('❌ Recorrência Água não encontrada');
    await prisma.$disconnect();
    return;
  }

  console.log('Recorrência encontrada:');
  console.log('  ID:', agua.id);
  console.log('  Dia vencimento:', agua.dueDay);
  console.log('  Criada em:', new Date(agua.createdAt).toLocaleString('pt-BR'));

  // Deletar ocorrências antigas
  const deleted = await prisma.recurringBillOccurrence.deleteMany({
    where: { recurringBillId: agua.id }
  });
  console.log(`\n✅ ${deleted.count} ocorrências antigas removidas`);

  // Gerar novas ocorrências incluindo dezembro
  const today = new Date();
  const dueDay = agua.dueDay; // 18
  
  // Calcular data de dezembro
  const decemberDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
  
  console.log(`\nGerando ocorrências a partir de ${decemberDate.toLocaleDateString('pt-BR')}...\n`);

  for (let i = 0; i < 4; i++) {
    const dueDate = new Date(decemberDate);
    dueDate.setMonth(decemberDate.getMonth() + i);
    
    await prisma.recurringBillOccurrence.create({
      data: {
        tenantId: agua.tenantId,
        recurringBillId: agua.id,
        dueDate,
        amount: agua.amount,
        status: 'pending',
      },
    });
    
    console.log(`✅ Criada: ${dueDate.toLocaleDateString('pt-BR')} | R$ ${agua.amount}`);
  }

  console.log('\n✅ Ocorrências regeneradas com sucesso!');
  
  await prisma.$disconnect();
})();
